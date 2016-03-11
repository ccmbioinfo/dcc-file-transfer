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
        if ($('tbody[name="'+$('#sample-text').val()+'"]').length === 0 && $('#sample-text').val() !== "") {
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
        $('.add-sample-button').show();
        $('.cancel-sample-button').hide();

        var fileTemplate = $('.sample-file-template').first().clone();
        fileTemplate.attr('id', file.uniqueIdentifier);
        fileTemplate.find('.file-name').html(file.fileName);
        fileTemplate.find('.progress-bar');
        $('tbody[name="' + sampleName + '"]').append(fileTemplate);
        if ($('tbody[name="' + sampleName + '"]').find('tr').hasClass('files-collapsed') === true) {
            fileTemplate.addClass('collapsed');
        }
        // Check for file type and auto-fill options with blanks for non-bam or fastq files
        var metadataRequired = false;
        var fileTypes = ['.bam','.sam','.fastq','.fq'];
        for (var i = 0; i < fileTypes.length; i++) {
            if (file.fileName.toLowerCase().indexOf(fileTypes[i]) > -1){
                metadataRequired = true;
                if (i > 1) {
                    fileTemplate.find('.file-type>button').html('FASTQ'+'<span class="caret"></span>').addClass('selection-made');
                } else {
                    fileTemplate.find('.file-type>button').html('BAM/SAM'+'<span class="caret"></span>').addClass('selection-made');
                }
                break;
            }
        }
        if (metadataRequired === false) {
            fileTemplate.find('.file-type>button').html('Other'+'<span class="caret"></span>').addClass('selection-made');
            fileTemplate.find('.library').addClass('edit-disabled').text('');
            fileTemplate.find('.run-type').addClass('edit-disabled').find('button').addClass('no-selection disabled').text('');
            fileTemplate.find('.platform').addClass('edit-disabled').find('button').addClass('no-selection disabled').text('');
            fileTemplate.find('.capture-kit').addClass('edit-disabled').find('button').addClass('no-selection disabled').text('');
        }
        fileTemplate.show();

        // Wait until all files have been added before clearing the sample name
        if ($('.sample-file-template').length == r.files.length+1) {
            $('#sample-text').val('');
        }
        checkUploadReady();
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
        $('.sample-table td:nth-child(10), .sample-table th:nth-child(10)').toggle();
        $('.sample-table td:nth-child(9), .sample-table th:nth-child(9)').toggle();
        $('.sample-option').addClass('disabled');
        //disable all metadata options
        $('.table-data').find('tbody').nextAll().find('button').addClass('disabled');
        $('.table-data').find('tbody').nextAll().find('.sample-name, .readset, .library').addClass('edit-disabled');
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

    function checkUploadReady() {
        // Check to see if all files have metadata completed before enabling the upload button
        var samples = $('.table-data').find('tbody').nextAll();
        if (r.files.length > 0 &&
            samples.find('button').length === samples.find('button').filter('.selection-made, .no-selection').length &&
            samples.find('.readset, .library').filter(function (index) {
                return $(this).html() === '* <em>Required</em>'
            }).length === 0) {
            $('.upload-sample-button').removeClass('disabled').addClass('active');
        } else {
            $('.upload-sample-button').addClass('disabled').removeClass('active');
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
        $('.resumable-drop').hide();
    });

    // Remove file from add sample table
    $('.table-data').on('click', '.remove-file', function (e) {
        uniqueId = $(this).closest('tr').attr('id');
        resumableFile = r.getFromUniqueIdentifier(uniqueId);
        r.removeFile(resumableFile);
        $(this).closest('tr').remove();
        checkUploadReady();
    });

    // Remove entire sample from add sample table
    $('.table-data').on('click', '.remove-sample', function (e) {
        var uniqueIds = [];

        fileRows = $(this).closest('tr').nextUntil('.sample-header-template');
        fileRows.each(function (key, value) {
            uniqueIds.push($(value).attr('id'));
        });
        for (i = 0; i < uniqueIds.length; i++) {
            resumableFile = r.getFromUniqueIdentifier(uniqueIds[i]);
            r.removeFile(resumableFile);
        }
        fileRows.remove();
        $(this).closest('tbody').remove();
        checkUploadReady();
    });

    // Add files to a specific sample
    $('.table-data').on('click', '.add-files', function (e) {
        sampleName = $(this).parents('tr').find('.sample-name').text();
    });

    // Edit data in table
    $('.table-data').editableTableWidget();
    $('.table-data').on('change', 'td', function(evt, newValue) {
        // may be useful for resizing
        checkUploadReady();
    });
    $('.table-data').on('validate', 'td', function(evt, newValue) {
        if (newValue === '') {
            return false; // mark cell as invalid
        }
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

    // Collapse samples
    $('.table-data').on('click', '.sample-collapse', function (e){
        triangle = $(this).closest('tr').find('.sample-collapse.glyphicon');
        fileRows = $(this).closest('tr').nextUntil('.sample-header-template');
        fileRows.each(function (key, value) {
            if ($(value).hasClass('collapsed') === true) {
                $(value).removeClass('collapsed').css('display','table-row');
            } else {
                $(value).addClass('collapsed').css('display','none');
            }
        });
        if ($(this).closest('tr').hasClass('files-collapsed') === true) {
            $(this).closest('tr').removeClass('files-collapsed');
            $(triangle).removeClass('glyphicon-triangle-right').addClass('glyphicon-triangle-bottom');
        } else {
            $(this).closest('tr').addClass('files-collapsed');
            $(triangle).removeClass('glyphicon-triangle-bottom').addClass('glyphicon-triangle-right');
        }
    });

    // Drop-down menu selection
    $('.table-data').on('click', '.menu-item', function (e){
        var item = $(this).text();
        $(this).closest('td').find('button').html(item+'<span class="caret"></span>').addClass('selection-made');
        // For changes to the file-type, adjust other metadata options accordingly
        if ($(this).closest('td').hasClass('file-type') && (item === 'BAM/SAM' || item === 'FASTQ')) {
            $(this).closest('tr').find('.library').removeClass('edit-disabled').html('* '+'<em>Required</em>');
            $(this).closest('tr').find('.run-type>button, .platform>button, .capture-kit>button')
                .removeClass('no-selection selection-made disabled')
                .html('Select'+'<span class="caret"></span>');
        } else if ($(this).closest('td').hasClass('file-type') && item === 'Other') {
            $(this).closest('tr').find('.library').addClass('edit-disabled').text('');
            $(this).closest('tr').find('.run-type, .platform, .capture-kit')
                .addClass('edit-disabled')
                .find('button')
                .removeClass('selection-made')
                .addClass('no-selection disabled')
                .text('');
        }
        checkUploadReady();
    });

    // Begin uploading files
    $('.upload-sample-button').on('click', function (e) {
        if ($(this).hasClass('disabled') === false) {
            $(this).removeClass('active').addClass('disabled');
            $('.add-sample-button').removeClass('active').addClass('disabled');
            $('#sample-text').prop('disabled', true);
            r.upload();
        }
    });

});
