$(function() {
    var r = new Resumable({
        target: '/upload',
        chunkSize: 1*1024*1024,
        simultaneousUploads: 3,
        testChunks: true,
        throttleProgressCallbacks: 1,
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
          progress.find('.progress-text').first().html('Uploading...');
          // Show pause, hide resume
          $('.resumable-progress .progress-resume-link').hide();
          $('.resumable-progress .progress-pause-link').show();
          // Add the file to the list
          $('#resumable-transfers > tbody').append(progress);
          // Ensure file list is shown
          $('#resumable-transfers').show();
          // Actually start the upload
          r.upload();
        });
      r.on('fileSuccess', function(file,message){
          // Reflect that the file upload has completed
          getFileProgressElt(file).find('.progress-text').html('Completed.');
          getFileProgressElt(file).find('.progress-pause').hide();
        });
      r.on('fileError', function(file, message){
          // Reflect that the file upload has resulted in error
          getFileProgressElt(file).find('.progress-text').html('Error: '+message);
        });
      r.on('fileProgress', function(file){
          // Handle progress for both the file and the overall upload
          var progress = getFileProgressElt(file);
          progress.find('.progress-text').html(Math.floor(file.progress()*100) + '%');
          progress.find('.progress-bar').css({width:Math.floor(r.progress()*100) + '%'});
        });
      r.on('uploadStart', function(){
          // Show pause, hide resume
          $('.resumable-progress .progress-resume-link').hide();
          $('.resumable-progress .progress-pause-link').show();
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

    $('body').on('click', '.progress-resume-link', function() {
        // Resume upload of this file
        var progress = $(this).closest('.resumable-progress');
        var uniqueIdentifier = progress.attr('data-file-id');
        r.getFromUniqueIdentifier(uniqueIdentifier).pause(false);
        r.getFromUniqueIdentifier(uniqueIdentifier).retry();
        // Show 'pause' button, hide 'resume' button
        progress.find('.progress-pause-link').show();
        progress.find('.progress-resume-link').hide();
        return false;
    });
    $('body').on('click', '.progress-pause-link', function() {
        // Pause upload of this file
        var progress = $(this).closest('.resumable-progress');
        var uniqueIdentifier = progress.attr('data-file-id');
        r.getFromUniqueIdentifier(uniqueIdentifier).pause();
        console.log(r.getFromUniqueIdentifier(uniqueIdentifier));
        // Show 'resume' button, hide 'pause' button
        progress.find('.progress-pause-link').hide();
        progress.find('.progress-resume-link').show();
        return false;
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
});
