$(function(){

    // Authentication displays option to add sample
    $('.auth-token-form').on("submit", function(e){
        // make sure we don't actually submit the form,
        // since this will refresh the whole page!
        return false;
    });

    $('.auth-token-form').on("submit", function(e){
        $.post("/authorize",
            {
                'authToken': $('#auth-token').val()
            }
        ).done(function(data){
            $('.transfer-symbol').removeClass('glyphicon-exclamation-sign').addClass('glyphicon-ok-sign');
            $('.add-sample-button').show();
            $('.cancel-sample-button').show().addClass('disabled');
            $('#auth-token').prop('disabled', true);
            $('.auth-success').css("background-color", "#5cb85c");
        }).fail(function(data){
            $('.transfer-symbol').removeClass('glyphicon-exclamation-sign').addClass('glyphicon-remove-sign')
            $('.auth-success').css("background-color", "#d9534f");
        });
        return false;
    });

    // Clicking add sample disables it until name and files have been supplied
    $('.add-sample-button').on('click', function(e){
        if ($( ".add-sample-button" ).hasClass( "disabled" ) == false) {
            $('.add-sample-button').addClass('disabled');
            $('.cancel-sample-button').removeClass('disabled');
            $('.sample-name-form').show();
        }
     });

    // Cancel sample will clear/hide the sample name and hide the drop area
    $('.cancel-sample-button').on('click', function(e){
        if ($( ".cancel-sample-button" ).hasClass( "disabled" ) == false) {
            $('.add-sample-button').removeClass('disabled');
            $('.cancel-sample-button').addClass('disabled');
            $('.sample-name-form').hide();
            $('.resumable-drop').hide();
            $('#sample-name').removeAttr('value');
            $('#sample-name').prop('disabled', false);
            $('.edit-sample-name').css("background-color", "#eee")
        }
     });


    var sampleName
    // Submitting a sample name will open the drop area and enable name editing
    $('.sample-name-form').on("submit", function(e){
        sampleName = $('#sample-name').val();
        $('#sample-name').prop('disabled', true);
        $('.resumable-drop').show();
        $('.edit-sample-name').css("background-color", "white")
        headerDone = false;
        return false;
    });

    // Editing the sample name will remove the drop area
    $('.edit-sample-name').on("click", function(e){
        $('#sample-name').prop('disabled', false);
        $('.resumable-drop').hide();
        $('.edit-sample-name').css("background-color", "#eee")
    });

    // Helper function from Orion, not 100% sure where necessary yet...
    function getExtraParams(file, chunk) {
        return {'authToken': $('#auth-token').val()};
    };

    function getFileProgressElt(file) {
        return $('#'+file.uniqueIdentifier);
    };


    // An array for storing current resumable objects
    var resumableArray = [];

    // Create a new resumable object
    var r = new Resumable({
        target: '/upload',
        chunkSize: 1*1024*1024,
        simultaneousUploads: 3,
        testChunks: true,
        testMethod: 'HEAD',
        prioritizeFirstAndLastChunk: true,
        query: getExtraParams,
        permanentErrors:[400, 403, 404, 415, 500, 501]
    });

    // Assign dropping/selecting files to resumable object
    r.assignDrop($('.resumable-drop')[0]);
    r.assignBrowse($('.resumable-browse')[0]);


    r.on('fileAdded', function(file){
        // Ensures that sample header is written once
        // (there has to be a better way to do this??)
        if (headerDone == false) {
            $('.resumable-drop').hide();
            $('.sample-name-form').hide();
            $('.add-sample-button').removeClass('disabled');
            $('.cancel-sample-button').addClass('disabled');
            $('#sample-name').removeAttr('value');
            $('#sample-name').prop('disabled', false);
            $('.edit-sample-name').css("background-color", "#eee")

            // Show the sample table
            $('.sample-table').show();

            // Add the sample header
            var sampleTemplate = $('.sample-header-template').first().clone();
            sampleTemplate.attr('id', sampleName);
            sampleTemplate.find('.sample-name').html(sampleName)
            $('.table-data').append(sampleTemplate)
            sampleTemplate.show();

            headerDone = true;
            $('.add-sample-button').addClass('disabled');
            $('.upload-sample-button').addClass('active').show();
        };

        var fileTemplate = $('.sample-file-template').first().clone();
        fileTemplate.attr('id', file.uniqueIdentifier);
        fileTemplate.find('.file-name').html(file.fileName);
        fileTemplate.find('.progress-bar').html('Ready...');
        $('.table-data').append(fileTemplate);
        fileTemplate.show();
    });

    r.on('fileProgress', function(file){
        var progress = getFileProgressElt(file);
        var percent = Math.floor(file.progress() * 100);
        progress.find('.progress-bar').html(percent + '%');
        progress.find('.progress-bar').css({width: percent + '%'});
        progress.find('.progress-bar').css("color", "white");
    });

    r.on('uploadStart', function(){
        //should probably hide options, or grey them out
    });

    r.on('fileSuccess', function(file, message){
        var progress = getFileProgressElt(file);
        progress.find('.progress-bar').first()
          .removeClass('progress-bar-striped active')
          .addClass('progress-bar-success')
          .html('Uploaded');
    });

    r.on('fileError', function(file, message){
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
          .css({width: '100%'})
          .html(errorMsg);
    });



    $('.upload-sample-button').on("click", function(e){
        if ($( ".upload-sample-button" ).hasClass('disabled') == false) {
            $(this).removeClass('active').addClass('disabled');
            r.upload();
        }
    });

});