$(function() {
    function getExtraParams(file, chunk) {
        return {'authToken': $('#auth-token').val()};
    };

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

    function getFileProgressElt(file) {
        return $('#resumable-file-'+file.uniqueIdentifier);
    };

    // Resumable.js isn't supported, fall back on a different method
    if(!r.support) {
      $('.resumable-error').show();
    } else {
      // Show a place for dropping/selecting files
      $('.resumable-drop').show();
      r.assignDrop($('.resumable-drop')[0]);
      r.assignBrowse($('.resumable-browse')[0]);
      // Handle file add event
      r.on('fileAdded', function(file) {
          // Create a new progress bar from template
          var template = $('#resumable-progress-template').clone();
          template.attr('id', 'resumable-file-'+file.uniqueIdentifier);
          template.attr('data-file-id', file.uniqueIdentifier);
          template.find('.progress-filename').first().html(file.fileName);
          template.find('.progress-bar').html('Starting upload...');
          // Add the file to the list
          $('#resumable-transfers').append(template);

          // Show pause, hide resume
          var progress = getFileProgressElt(file);
          progress.find('.progress-cancel-link').show();
          progress.find('.progress-retry-link').hide();
          // Ensure file list is shown
          $('.current-uploads').show();
          // Actually start the upload
          r.upload();
        });
      r.on('fileSuccess', function(file, message){
          // Reflect that the file upload has completed
          var progress = getFileProgressElt(file);
          progress.find('.progress-bar').first()
              .removeClass('progress-bar-striped active')
              .addClass('progress-bar-success')
              .html('Uploaded');
          getFileProgressElt(file).find('.progress-cancel-link').hide();
        });
      r.on('fileError', function(file, message){
          // Reflect that the file upload has resulted in error
          var progress = getFileProgressElt(file);
          var errorMsg = 'Error';
          try {
              errorMsg += ': ' + $.parseJSON(message).message;
          } catch (e) {
          }
          progress.find('.progress-bar')
              .removeClass('progress-bar-striped active')
              .addClass('progress-bar-danger')
              .html(errorMsg);
          progress.find('.progress-cancel-link').hide();
          progress.find('.progress-retry-link').show();
        });
      r.on('fileProgress', function(file){
          // Handle progress for both the file and the overall upload
          var progress = getFileProgressElt(file);
          var percent = Math.floor(file.progress() * 100);
          progress.find('.progress-bar').html(percent + '%');
          progress.find('.progress-bar').css({width: percent + '%'});
        });
      r.on('uploadStart', function(){
          // Show pause, hide resume
          $('.progress-resume-link').hide();
          $('.progress-pause-link').show();
      });
    }

    $('.resumable-drop').on('dragenter', function() {
        $(this).addClass('resumable-dragover');
    });
    $('.resumable-drop').on('dragend', function() {
        $(this).removeClass('resumable-dragover');
    });
    $('.resumable-drop').on('drop', function() {
        $(this).removeClass('resumable-dragover');
    });

    $('body').on('click', '.progress-cancel-link', function() {
        // Cancel upload of this file
        var progress = $(this).closest('.resumable-progress');
        var uniqueIdentifier = progress.attr('data-file-id');
        r.getFromUniqueIdentifier(uniqueIdentifier).cancel();
        // Remove row
        progress.remove();
        return false;
    });
    $('body').on('click', '.progress-retry-link', function() {
        // Retry upload of this file
        var progress = $(this).closest('.resumable-progress');
        var uniqueIdentifier = progress.attr('data-file-id');
        r.getFromUniqueIdentifier(uniqueIdentifier).retry();

        progress.find('.progress-bar').first()
            .removeClass('progress-bar-warning progress-bar-danger')
            .addClass('progress-bar-striped active')
            .html('Retrying...');
        progress.find('.progress-cancel-link').show();
        progress.find('.progress-retry-link').hide();
        return false;
    });
    $('.progress-resume-link').on('click', function() {
        // Resume upload of all files
        r.upload();
        // Show 'pause' button, hide 'resume' button
        $('.progress-pause-link').show();
        $('.progress-resume-link').hide();
        return false;
    });
    $('.progress-pause-link').on('click', function() {
        // Pause upload of all files
        r.pause();
        // Show 'resume' button, hide 'pause' button
        $('.progress-pause-link').hide();
        $('.progress-resume-link').show();
        return false;
    });
});
