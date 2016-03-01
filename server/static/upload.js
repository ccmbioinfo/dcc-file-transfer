$(function() {
    
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
    r.on('fileAdded', function(file) {
        // Ensures that sample header is written once
        // (there has to be a better way to do this??)
        if ($('tbody[name="' + sampleName + '"]').length == 0) {
            // Add the sample header
            var sampleTemplate = $('.sample-header-template').first().clone();
            sampleTemplate.find('.sample-name').html(sampleName)
            sampleTemplate.wrap('<tbody></tbody>');
            sampleTemplate.parent().attr('name', sampleName);
            $('.table-data').append(sampleTemplate.parent())
            sampleTemplate.show();
            r.assignBrowse(sampleTemplate.find('.resumable-add'));
        }
        ;
        
        // Show the sample table
        $('#sample-text').removeAttr('value').prop('disabled', false);
        $('.edit-sample-name').css('background-color', '#eee')
        $('.resumable-drop').hide();
        $('.sample-name-form').hide();
        $('.upload-sample-button').addClass('active').show().removeClass('disabled');
        $('.add-sample-button').show();
        $('.cancel-sample-button').hide();
        
        var fileTemplate = $('.sample-file-template').first().clone();
        fileTemplate.attr('id', file.uniqueIdentifier);
        fileTemplate.find('.file-name').html(file.fileName);
        fileTemplate.find('.progress-bar').html('Ready...');
        $('tbody[name="' + sampleName + '"]').append(fileTemplate);
        fileTemplate.show();
    
    
    });
    r.on('fileProgress', function(file) {
        var progress = getFileProgressElt(file);
        var percent = Math.floor(file.progress() * 100);
        progress.find('.progress-bar').html(percent + '%');
        progress.find('.progress-bar').css({
            width: percent + '%'
        });
        progress.find('.progress-bar').css('color', 'white');
        progress.find('.progress-bar').css('min-width', '2em')
    });
    r.on('uploadStart', function() {
        //should probably hide options, or grey them out
        //send message to server indicating token, samples, and files for db storage
    });
    r.on('fileSuccess', function(file, message) {
        var progress = getFileProgressElt(file);
        progress.find('.progress-bar').first()
        .removeClass('progress-bar-striped active')
        .addClass('progress-bar-success')
        .html('Uploaded');
    });
    r.on('fileError', function(file, message) {
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
    r.on('complete', function() {
        //enable ability to add new samples/files? allow for upload again?
        //populate the DCC table with files and empty the upload table?
    });
    
    function getFileProgressElt(file) {
        return $('#' + file.uniqueIdentifier);
    }
    ;
    
    function getExtraParams(file, chunk) {
        return {
            'authToken': $('#auth-token').val()
        };
    }
    ;
    
    // Remove file from resumable array using the file name
    function removeResumableFile(fileName) {
        fileObj = r.files.filter(function(obj) {
            return obj.fileName == fileName
        })[0];
        fileIndex = r.files.indexOf(fileObj);
        r.files.splice(fileIndex, 1);
    }
    ;
    
    // Authentication displays option to add sample
    $('.auth-token-form').on('submit', function(e) {
        $.post('/authorize', 
        {
            'authToken': $('#auth-token').val()
        }
        ).done(function(data) {
            $('.transfer-symbol').removeClass('glyphicon-exclamation-sign').addClass('glyphicon-ok-sign');
            $('.add-sample-button').show();
            $('#auth-token').prop('disabled', true);
            $('.auth-success').css('background-color', '#5cb85c');
            $('.sample-table').show();
            $('.dcc-table').show();
        
        }).fail(function(data) {
            $('.transfer-symbol').removeClass('glyphicon-exclamation-sign').addClass('glyphicon-remove-sign')
            $('.auth-success').css('background-color', '#d9534f');
        });
        // make sure we don't actually submit the form,
        // since this will refresh the whole page!
        return false;
    });
    
    // Clicking add sample hides it until name and files have been supplied
    $('.add-sample-button').on('click', function(e) {
        if ($(this).hasClass('active') == true) {
            $(this).hide();
            $('.cancel-sample-button').show();
            $('.sample-name-form').show();
        }
    });
    
    // Submitting a sample name will open the drop area and enable name editing
    $('.sample-name-form').on('submit', function(e) {
        sampleName = $('#sample-text').val();
        $('#sample-text').prop('disabled', true);
        $('.resumable-drop').show();
        $('.edit-sample-name').css('background-color', 'white');
        return false;
    });
    
    // Cancel sample will clear/hide the sample name and hide the drop area
    $('.cancel-sample-button').on('click', function(e) {
        $('.cancel-sample-button').hide();
        $('.add-sample-button').show();
        $('.upload-sample-button').removeClass('disabled');
        $('.sample-name-form').hide();
        $('.resumable-drop').hide();
        $('#sample-text').removeAttr('value');
        $('#sample-text').prop('disabled', false);
        $('.edit-sample-name').css('background-color', '#eee')
        
    });
    
    // Editing the sample name will remove the drop area
    $('.edit-sample-name').on('click', function(e) {
        $('#sample-text').prop('disabled', false);
        $('.resumable-drop').hide();
        $('.edit-sample-name').css('background-color', '#eee')
    });
    
    // Remove file from add sample table
    $('.table-data').on('click', '.remove-file', function(e) {
        fileName = $(this).parents('tr').find('.file-name').text();
        removeResumableFile(fileName);
        $(this).parents('tr').remove();
    });
    
    // Remove entire sample from add sample table
    $('.table-data').on('click', '.remove-sample', function(e) {
        var fileNames = []
        
        fileRows = $(this).parents('tr').nextUntil('.sample-header-template')
        fileRows.each(function(key, value) {
            fileNames.push($(value).find('.file-name').text())
        });
        for (i = 0; i < fileNames.length; i++) {
            removeResumableFile(fileNames[i])
        }
        ;
        fileRows.remove();
        $(this).parents('tr').remove();
    });

    // Add files to a specific sample
    $('.table-data').on('click', '.add-files', function(e) {
        sampleName = $(this).parents('tr').find('.sample-name').text();
    });

    // Edit a sample name in table
    $('.table-data').on('click', '.edit-table-sample-name', function(e){
        sampleNode = $(this).parents('tr').find('.sample-name');
        currentName = sampleNode.text()
        sampleNode.replaceWith(function(){
            return $('<td class="sample-name"><form class=edit-sample-name-form>'+
            '<input id="sample-table-text" type="text" name="sampleName" class="form-control"'+
            'placeholder="'+currentName+'"></form></td>')
            });
    });
    $('.table-data').on('submit', '.edit-sample-name-form', function(e){
            newName = $(this).find('#sample-table-text').val();
            tbodyElem = $(this).parents('tbody');
            $(this).remove();
            tbodyElem.attr('name', newName).find('.sample-name').html(newName);
            return false;
    });

    // Collapse the table contents and show only the panel header
    $('.panel-heading').on('click', function(e) {
         if ($(this).find('.table-collapse').hasClass('glyphicon-triangle-right') == true) {
             $(this).parents('.panel').find('.panel-body').hide();
             $(this).parents('.panel').find('.table').hide();
             $(this).find('.table-collapse').removeClass('glyphicon-triangle-right').addClass('glyphicon-triangle-bottom');
         } else if ($(this).find('.table-collapse').hasClass('glyphicon-triangle-bottom') == true) {
             $(this).parents('.panel').find('.panel-body').show();
             $(this).parents('.panel').find('.table').show();
             $(this).find('.table-collapse').removeClass('glyphicon-triangle-bottom').addClass('glyphicon-triangle-right');
         }
    });

    // Begin uploading files
    $('.upload-sample-button').on('click', function(e) {
        if ($(this).hasClass('disabled') == false && r.files.length > 0) {
            $(this).removeClass('active').addClass('disabled');
            $('.add-sample-button').removeClass('active').addClass('disabled');
            r.upload();
        }
    });

});
