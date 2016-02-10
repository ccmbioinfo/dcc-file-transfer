$(function() {
    var r = new Resumable({
        target: '/upload',
        chunkSize: 1*1024*1024,
        simultaneousUploads: 3,
        testChunks: true,
        testMethod: 'HEAD',
        prioritizeFirstAndLastChunk: true,
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
          var progress = $('#resumable-progress-template').clone();
          progress.attr('id', 'resumable-file-'+file.uniqueIdentifier);
          progress.attr('data-file-id', file.uniqueIdentifier);
          progress.find('.progress-filename').first().html(file.fileName);
          progress.find('.progress-bar').html('Starting upload...');
          // Show pause, hide resume
          $('.resumable-progress .progress-resume-link').hide();
          $('.resumable-progress .progress-pause-link').show();
          // Add the file to the list
          $('#resumable-transfers').append(progress);
          // Ensure file list is shown
          $('.current-uploads').show();
          // Actually start the upload
          r.upload();
        });
      r.on('fileSuccess', function(file,message){
          // Reflect that the file upload has completed
          var progress = getFileProgressElt(file);
          progress.find('.progress-bar').first()
              .removeClass('progress-bar-striped active')
              .html('Uploaded');
          getFileProgressElt(file).find('.progress-cancel-link').hide();
        });
      r.on('fileError', function(file, message){
          // Reflect that the file upload has resulted in error
          var progress = getFileProgressElt(file);
          progress.find('.progress-bar')
              .removeClass('progress-bar-striped active')
              .html('Error');
          progress.getFileProgressElt(file).find('.progress-cancel-link').hide();
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
