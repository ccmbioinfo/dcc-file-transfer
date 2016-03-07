$(function () {

    // Create a new resumable object
    var r = new Resumable({
        target: '/upload',
        chunkSize: 1 * 1024 * 1024,
        simultaneousUploads: 3,
        testChunks: true,
        testMethod: 'HEAD',
        prioritizeFirstAndLastChunk: true,
        query: getExtraParams,
        permanentErrors: [400, 403, 404, 415, 500, 501]
    });
    r.assignDrop($('.resumable-drop'));
    r.assignBrowse($('.resumable-browse'));
    r.on('fileAdded', function (file) {
        // Ensures that sample header is written once
        if ($('tbody[name="' + $('#sample-text').val() + '"]').length === 0) {
            // Add the sample header
            sampleName = $('#sample-text').val();
            var sampleTemplate = $('.sample-header-template').first().clone();
            sampleTemplate.find('.sample-name').html(sampleName);
            sampleTemplate.wrap('<tbody></tbody>');
            sampleTemplate.parent().attr('name', sampleName);
            $('.table-data').append(sampleTemplate.parent());
            sampleTemplate.show();
            r.assignBrowse(sampleTemplate.find('.resumable-add'));
        }
        // Show the sample table
        $('.resumable-drop').hide();
        $('.upload-sample-button').addClass('active').removeClass('disabled');
        $('.add-sample-button').show();
        $('.cancel-sample-button').hide();

        var fileTemplate = $('.sample-file-template').first().clone();
        fileTemplate.attr('id', file.uniqueIdentifier);
        fileTemplate.find('.file-name').html(file.fileName);
        fileTemplate.find('.progress-bar');
        $('tbody[name="' + sampleName + '"]').append(fileTemplate);
        fileTemplate.show();

        // Wait until all files have been added before clearing the sample name
        if ($('.sample-file-template').length == r.files.length+1) {
            $('#sample-text').removeAttr('value');
        }

    });
    r.on('fileProgress', function (file) {
        var progress = getFileProgressElt(file);
        var percent = Math.floor(file.progress() * 100);
        progress.find('.progress-bar').html(percent + '%');
        progress.find('.progress-bar').css({
            width: percent + '%'
        });
        progress.find('.progress-bar').css('color', 'white');
        progress.find('.progress-bar').css('min-width', '2em')
    });
    r.on('uploadStart', function () {
        //hide the options column and show the status column
        $('.sample-table td:nth-child(5), .sample-table th:nth-child(5)').toggle();
        $('.sample-table td:nth-child(4), .sample-table th:nth-child(4)').toggle();
        //send message to server indicating token, samples, and files for db storage
    });
    r.on('fileSuccess', function (file, message) {
        var progress = getFileProgressElt(file);
        progress.find('.progress-bar').first()
            .removeClass('progress-bar-striped active')
            .addClass('progress-bar-success')
            .html('Uploaded');
    });
    r.on('fileError', function (file, message) {
        // Reflect that the file upload has resulted in error
        var progress = getFileProgressElt(file);
        var errorMsg = 'Error';
        try {
            errorMsg = $.parseJSON(message).message;
        } catch (e) {
        }
        progress.find('.progress-bar')
            .removeClass('progress-bar-striped active')
            .addClass('progress-bar-danger')
            .css({
                width: '100%'
            })
            .html(errorMsg);
    });
    r.on('complete', function () {
        //enable ability to add new samples/files? allow for upload again?
        //populate the DCC table with files and empty the upload table?
    });

    $('.resumable-drop').on('dragenter', function() {
        $(this).addClass('resumable-dragover').find('span').css('pointer-events','none');
        $(this).find('.resumable-browse').css('pointer-events','none');
    });
    $('.resumable-drop').on('dragleave', function() {
        $(this).removeClass('resumable-dragover').find('span').css('pointer-events','auto');
        $(this).find('.resumable-browse').css('pointer-events','auto');
    });
    $('.resumable-drop').on('dragend', function() {
        $(this).removeClass('resumable-dragover');
        $(this).find('.resumable-browse').css('pointer-events','auto');
    });
    $('.resumable-drop').on('drop', function() {
        $(this).removeClass('resumable-dragover');
        $(this).find('.resumable-browse').css('pointer-events','auto');
    });

    function getFileProgressElt(file) {
        return $('#' + file.uniqueIdentifier);
    }

    function getExtraParams(file, chunk) {
        return {
            'authToken': $('#auth-token').val()
        }
    }

    // Authentication displays option to add sample
    $('.auth-token-form').on('submit', function (e) {
        $.post('/authorize', {'authToken': $('#auth-token').val()})
            .done(function (data) {
                $('.transfer-symbol').removeClass('glyphicon-exclamation-sign').addClass('glyphicon-ok-sign');
                $('#auth-token').prop('disabled', true);
                $('.auth-success').removeClass('label-warning label-danger').addClass('label-success');
                $('.sample-table, .dcc-table').show();
            })
            .fail(function (data) {
                $('.transfer-symbol').removeClass('glyphicon-exclamation-sign').addClass('glyphicon-remove-sign');
                $('.auth-success').removeClass('label-warning').addClass('label-danger');
            });
        return false;
    });

    // Clicking add sample hides it until name and files have been supplied
    $('.add-sample-button').on('click', function (e) {
        if ($(this).prev('input').val().length > 0) {
            $(this).toggle();
            $('.resumable-drop').show();
            $('.cancel-sample-button').toggle().css('display', 'table-cell');
        }
    });

    // Submitting a sample name will open the drop area and enable name editing
    $('.sample-name-form').on('submit', function (e) {
        if ($(this).find('input').val().length > 0) {
            $('.resumable-drop').show();
            $('.add-sample-button').hide();
            $('.cancel-sample-button').show().css('display', 'table-cell');
        }
        return false;
    });

    // Cancel sample will clear/hide the sample name and hide the drop area
    $('.cancel-sample-button').on('click', function (e) {
        $('.cancel-sample-button').toggle();
        $('.add-sample-button').toggle();
        $('.upload-sample-button').removeClass('disabled');
        $('.resumable-drop').hide();
    });

    // Remove file from add sample table
    $('.table-data').on('click', '.remove-file', function (e) {
        uniqueId = $(this).closest('tr').attr('id');
        resumableFile = r.getFromUniqueIdentifier(uniqueId);
        r.removeFile(resumableFile);
        $(this).closest('tr').remove();
        if (r.files.length === 0) {
            $('.upload-sample-button').removeClass('active').addClass('disabled');
        }
    });

    // Remove entire sample from add sample table
    $('.table-data').on('click', '.remove-sample', function (e) {
        var uniqueIds = [];

        fileRows = $(this).closest('tr').nextUntil('.sample-header-template');
        fileRows.each(function (key, value) {
            uniqueIds.push($(value).attr('id'));
        });
        for (i = 0; i < uniqueIds.length; i++) {
            r.removeFile(uniqueIds[i]);
        }
        fileRows.remove();
        $(this).closest('tbody').remove();
        if (r.files.length === 0) {
            $('.upload-sample-button').removeClass('active').addClass('disabled');
        }
    });

    // Add files to a specific sample
    $('.table-data').on('click', '.add-files', function (e) {
        sampleName = $(this).parents('tr').find('.sample-name').text();
    });

    // Edit a sample name in table
    $('.table-data').on('click', '.edit-table-sample-name', function (e) {
        sampleNode = $(this).parents('tr').find('.sample-name');
        currentName = sampleNode.text();
        sampleNode.replaceWith(function () {
            return $('<td class="sample-name"><form class=edit-sample-name-form>' +
                '<input id="sample-table-text" type="text" name="sampleName" class="form-control"' +
                'value="' + currentName + '"></form></td>')
        });
    });
    $('.table-data').on('submit', '.edit-sample-name-form', function (e) {
        newName = $(this).find('#sample-table-text').val();
        tbodyElem = $(this).closest('tbody');
        $(this).remove();
        tbodyElem.attr('name', newName).find('.sample-name').html(newName);
        return false;
    });

    // Collapse the table contents and show only the panel header
    $('.panel-heading').on('click', function (e) {
        $(this).closest('.panel').find('.panel-body, table, .panel-footer').toggleClass('collapsed');
        if ($(this).next('.panel-body').hasClass('collapsed') === true) {
            $(this).find('.glyphicon').removeClass('glyphicon-triangle-bottom').addClass('glyphicon-triangle-right');
        } else {
            $(this).find('.glyphicon').removeClass('glyphicon-triangle-right').addClass('glyphicon-triangle-bottom');
        }
    });

    // Begin uploading files
    $('.upload-sample-button').on('click', function (e) {
        if ($(this).hasClass('disabled') === false && r.files.length > 0) {
            $(this).removeClass('active').addClass('disabled');
            $('.add-sample-button').removeClass('active').addClass('disabled');
            r.upload();
        }
    });

});
