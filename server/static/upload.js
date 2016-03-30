$(function () {
    var reSampleName = /^[A-Z\d\-_]+$/i;
    var reLibrary = /^[A-Z\d\-_]*$/i;
    var reReadset = /^[A-Z\d\-_]*$/i;

    // Create a new resumable object
    var r = new Resumable({
        target: '/upload',
        chunkSize: 1 * 1024 * 1024,
        simultaneousUploads: 3,
        testChunks: true,
        testMethod: 'HEAD',
        prioritizeFirstAndLastChunk: true,
        generateUniqueIdentifier: createIdentifier,
        query: getExtraParams,
        permanentErrors: [400, 403, 404, 415, 500, 501]
    });

    r.assignDrop($('.resumable-drop, .resumable-modal-drop'));

    r.assignBrowse($('.resumable-browse'));

    r.on('fileAdded', function (file) {
        // check if file is coming through the add sample modal
        // sampleName needs to be redefined in this case
        if ($('#add-sample-modal').hasClass('in') && reSampleName.test($('#sampleName').val())) {
            sampleName = $('#sampleName').val();
            // Check if sample header already exists
            if ($('tbody[name="'+$('#sampleName').val()+'"]').length === 0) {
                // Add the sample header
                var sampleTemplate = $('.sample-header-template').first().clone();
                sampleTemplate.find('.sample-name').html(sampleName);
                sampleTemplate
                    .wrap('<tbody></tbody>')
                    .parent()
                    .attr('name', sampleName)
                    .appendTo($('.table-data'));
                sampleTemplate.show();
            }
            // handle file addition
            createFileRow(file, sampleName);
        } else if (!$('#add-sample-modal').hasClass('in')) {
            // handle file addition with given sampleName from table
            createFileRow(file, sampleName);
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

    r.on('fileSuccess', function (file, message) {
        var progress = getFileProgressElt(file);
        progress.find('.progress-bar').first()
            .removeClass('progress-bar-striped active')
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
        $('#upload-complete-modal').modal('show');
        //populate the DCC table with files and empty the upload table?
    });

    $('.resumable-drop, .resumable-modal-drop').on({
        'dragenter': function() {
            $(this).addClass('resumable-dragover').find('span').css('pointer-events','none');
            $(this).find('.resumable-browse').css('pointer-events','none');
        },
        'dragleave': function() {
            $(this).removeClass('resumable-dragover').find('span').css('pointer-events','auto');
            $(this).find('.resumable-browse').css('pointer-events','auto');
        },
        'dragend': function() {
            $(this).removeClass('resumable-dragover');
            $(this).find('.resumable-browse').css('pointer-events','auto');
        },
        'drop': function() {
            $(this).removeClass('resumable-dragover');
            $(this).find('.resumable-browse').css('pointer-events','auto');
        }
    });

    function createIdentifier(file) {
        // Unique identifier includes the transfer code, sample name, file name, and file size
        if ($('#add-sample-modal').hasClass('in')) {
            var sample = $('#sampleName').val();
        } else {
            sample = sampleName
        }
        var cleanName = file.name.replace(/[^0-9A-Z_-]/img, '');
        return $('#auth-token').val()+'_'+sample+'_'+cleanName+'_'+file.size
    }

    function getFileProgressElt(file) {
        return $('#'+file.uniqueIdentifier);
    }

    function getExtraParams(file, chunk) {
        var fileRow = getFileProgressElt(file);
        return {
            'authToken': $('#auth-token').val(),
            'sampleName': fileRow.closest('tbody').attr('name'),
            'fileType': fileRow.find('.file-type').text(),
            'readset': fileRow.find('.file-readset').text(),
            'platform': fileRow.find('.file-platform').text(),
            'runType': fileRow.find('.file-run-type').text(),
            'captureKit': fileRow.find('.file-capture-kit').text(),
            'library': fileRow.find('.file-library').text(),
            'reference': fileRow.find('.file-reference').text()
        }
    }

    function authorize() {
        $.post('/authorize', {'authToken': $('#auth-token').val()})
            .done(function (data) {
                $('.transfer-symbol').removeClass('glyphicon-log-in').addClass('glyphicon-ok-sign');
                $('#auth-token').prop('disabled', true).closest('.form-group').removeClass('has-error');
                $('.auth-success').addClass('disabled');
                $('.sample-table').show();
                $('.transfer-error').hide();
                $('.logout').toggle();
            })
            .fail(function (data) {
                $('#auth-token').closest('.form-group').addClass('has-error');
                $('.transfer-error').show();
                return false;
            });
    }

    function createFileRow(file, sampleName) {
        var sampleTable = $('tbody[name="' + sampleName + '"]');
        var fileTemplate = $('.sample-file-template').first().clone();
        fileTemplate
            .attr('id', file.uniqueIdentifier)
            .find('.file-name')
            .html(file.fileName);

        sampleTable.append(fileTemplate);
        if (sampleTable.find('tr').hasClass('files-collapsed')) {
            fileTemplate.addClass('collapsed');
        }
        // Check for file type to determine whether metadata options should be shown
        var fileType = 'Other';
        var fileTypes = {'.bam': 'BAM/SAM',
                         '.sam': 'BAM/SAM',
                         '.sam.gz': 'BAM/SAM',
                         '.fastq': 'FASTQ',
                         '.fastq.gz': 'FASTQ',
                         '.fq': 'FASTQ',
                         '.fq.gz': 'FASTQ',
                         '.vcf': 'VCF',
                         '.vcf.gz': 'VCF'};
        for (var ext in fileTypes) {
            if (fileTypes.hasOwnProperty(ext) &&
                file.fileName.toLowerCase().indexOf(ext) > -1) {
                fileType = fileTypes[ext];
            }
        }
        fileTemplate.find('.file-type').text(fileType);
        if (fileType !== 'Other') {
            fileTemplate.find('.file-platform').text($('#add-platform').val());
            fileTemplate.find('.file-run-type').text($('#add-run-type').find('option:selected').text());
            fileTemplate.find('.file-capture-kit').text($('#add-capture-kit').val());
            fileTemplate.find('.file-library').text($('#add-library').val());
            if (fileType === 'BAM/SAM' || fileType === 'VCF') {
                fileTemplate.find('.file-reference').text($('#add-reference').val());
            }
        }
        fileTemplate.show();

        // Wait until all files have been added before clearing the sample name in the modal
        // Plus one to include the original cloned sample-file-template
        if ($('.sample-file-template').length === r.files.length + 1) {
            $('#sampleName').val('').closest('.form-group').addClass('has-error');
        }
        checkUploadReady();
        $('#add-sample-modal').modal('hide');
        $('.resumable-modal-drop').hide();
    }

    function checkUploadReady() {
        $('.upload-sample-button').toggleClass('disabled', r.files.length === 0);
    }

    var substringMatcher = function(strs) {
        return function findMatches(queryString, cb) {
            var matches, substrRegex;
            matches = [];
            substrRegex = new RegExp(queryString, 'i');
            $.each(strs, function(i, str) {
                if (substrRegex.test(str)) {
                    matches.push(str);
                }
            });
            cb(matches);
        };
    };

    var platforms = ['Illumina HiSeq', 'Illumina X10', 'SOLiDv4', 'PacBio', 'Ion Torrent', 'MinION'];
    var captureKits = ['Nextera Rapid Capture', 'Agilent SureSelect', 'NimbleGen SeqCap EZ', 'Illumina TruSeq',
        'Life Technologies TargetSeq', 'Life Technologies AmpliSeq', 'Agilent HaloPlex'];
    var referenceGenomes = ['GRCh38/hg38', 'GRCh37/hg19', 'NCBI36/hg18'];


    // Authentication displays upload table
    $('.auth-token-form').on('submit', function (e) {
        authorize();
        return false;
    });
    $('.login').on('click', function() {
        authorize();
    });


    // Submitting a sample name will open the drop area and enable name editing
    $('#sampleName, #add-library').on('input', function (e) {
        if (reSampleName.test($('#sampleName').val()) &&
            reLibrary.test($('#add-library').val())) {
            $('.resumable-modal-drop').show();
        } else {
            $('.resumable-modal-drop').hide();
        }
        if (reSampleName.test($('#sampleName').val())) {
            $('#sampleName').closest('.form-group').removeClass('has-error');
        } else {
            $('#sampleName').closest('.form-group').addClass('has-error');
        }
        if (reLibrary.test($('#add-library').val())) {
            $('#add-library').closest('.form-group').removeClass('has-error');
        } else {
            $('#add-library').closest('.form-group').addClass('has-error');
        }
    });

    // Platform typeahead
    $('#add-platform, #edit-platform, #edit-single-platform').typeahead({
        hint: true,
        highlight: true,
        minLength: 1
    },{
        name: 'Platforms',
        source: substringMatcher(platforms)
    });

    // Capture Kit typeahead
    $('#add-capture-kit, #edit-capture-kit, #edit-single-capture-kit').typeahead({
        hint: true,
        highlight: true,
        minLength: 1
    },{
        name: 'CaptureKits',
        source: substringMatcher(captureKits)
    });

    // Reference genome typeahead
    $('#add-reference, #edit-reference, #edit-single-reference').typeahead({
        hint: true,
        highlight: true,
        minLength: 1
    },{
        name: 'referenceGenomes',
        source: substringMatcher(referenceGenomes)
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
        fileRows.each(function (i, value) {
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

    $('body').on('click', '.modal-add-sample-button', function (e) {
        $('#sampleName').prop('disabled', false);
    });

    // Add files to a specific sample
    $('.table-data').on('click', '.add-files', function (e) {
        sampleName = $(this).parents('tr').find('.sample-name').text();
        $('#sampleName').val(sampleName).prop('disabled', true).closest('.form-group').removeClass('has-error');
        $('.resumable-modal-drop').show();
    });

    // Enable editing of metadata options on entire sample
    $('input:checkbox').change( function() {
        if ($(this).is(':checked')) {
            $(this).closest('.form-group').find('.form-control').attr('disabled', false);
        } else {
            if ($(this).closest('.form-group').find('.form-control').is('#edit-run-type')) {
                $('#edit-run-type').val('N/A').attr('disabled', true);
            } else {
                $(this).closest('.form-group').removeClass('has-error').find('.form-control').val('').attr('disabled',true);
            }
        }
        if (!$('#edit-sample-name, #edit-readset, #edit-library').closest('.form-group').hasClass('has-error')){
            $('.save-edit-sample').prop('disabled', false);
        }
    });

    // Edit entire sample data
    $('.table-data').on('click', '.edit-sample, .sample-name', function (e) {
        sampleRow = $(this).closest('.sample-row');
        var currentName = sampleRow.find('.sample-name').text();
        $('#edit-sample-name').val(currentName);
        // Show modal in data-target
        var modalId = $(this).attr('data-target');
        if (modalId) {
            $(modalId).modal('show');
        }
        return false;
    });
    $('#edit-sample-name, #edit-readset, #edit-library').on('input', function (e) {
        var saveEnabled = reSampleName.test($('#edit-sample-name').val()) &&
            reReadset.test($('#edit-readset').val()) &&
            reLibrary.test($('#edit-library').val());
        $('.save-edit-sample').prop('disabled', !saveEnabled);

        $('#edit-sample-name')
            .closest('.form-group')
            .toggleClass('has-error', !reSampleName.test($('#edit-sample-name').val()));

        $('#edit-readset')
            .closest('.form-group')
            .toggleClass('has-error', !reReadset.test($('#edit-readset').val()))

        $('#edit-library')
            .closest('.form-group')
            .toggleClass('has-error', !reLibrary.test($('#edit-library').val()));
    });

    $('body').on('click', '.save-edit-sample', function (e) {
        var newName = $('#edit-sample-name').val();
        sampleRow.closest('tbody').attr('name', newName).find('.sample-name').text(newName);
        var fileRows = sampleRow.nextUntil();
        fileRows.each(function (i) {
            var fileType = $(this).find('.file-type').text();
            var fieldNames = ['readset'];
            if (fileType !== 'Other') {
                fieldNames.push('platform', 'run-type', 'capture-kit', 'library');
            }
            if (fileType === 'BAM/SAM' || fileType === 'VCF') {
                fieldNames.push('reference');
            }

            for (var i = 0; i < fieldNames.length; i++) {
                var fieldName = fieldNames[i];
                if ($('#edit-' + fieldName).closest('.form-group').find('input[type="checkbox"]').is(':checked')) {
                    $(this).find('.file-' + fieldName).text($('#edit-' + fieldName).val());
                }
            }
        });
        $('#edit-sample-modal').modal('hide');
        return false;
    });
    $('body').on('click', '.cancel-edit-sample', function (e) {
        // remove error on sample name so it won't linger when edit sample is clicked again
         $('#edit-sample-name').closest('.form-group').removeClass('has-error');
    });

    // Edit file data
    $('.table-data').on('click', '.edit-file, .file-name', function (e) {
        // Fill modal with the current file's data, and set options according to file type
        fileRow = $(this).closest('tr');
        var fileType = fileRow.find('.file-type').text();
        $('.file-name-title').text(fileRow.find('.file-name').text());
        $('#edit-file-modal')
            .find('option:contains("type")'.replace('type', fileType))
            .attr('selected',true);
        $('#edit-single-readset').val(fileRow.find('.file-readset').text());
        // File type dependent options
        if (fileType === 'BAM/SAM' || fileType === 'VCF') {
            $('#edit-single-reference').attr('disabled', false);
            $('#edit-single-reference').typeahead('val', fileRow.find('.file-reference').text());
        } else {
            $('#edit-single-reference').typeahead('val', '').attr('disabled', true);
        }
        if (fileType === 'Other') {
            $('#edit-single-platform, #edit-single-run-type, #edit-single-capture-kit, #edit-single-library')
                .attr('disabled', true);
            $('#edit-single-platform, #edit-single-capture-kit, #edit-single-reference').typeahead('val', '');
            $('#edit-single-library').val('');
            $('#edit-single-run-type').val('N/A');
        } else {
            $('#edit-single-platform, #edit-single-run-type, #edit-single-capture-kit, #edit-single-library')
                 .attr('disabled', false);
            $('#edit-single-platform').typeahead('val', fileRow.find('.file-platform').text());
            $('#edit-single-run-type').val(fileRow.find('.file-run-type').text());
            $('#edit-single-capture-kit').typeahead('val', fileRow.find('.file-capture-kit').text());
            $('#edit-single-library').val(fileRow.find('.file-library').text());
        }
    });
    $('#edit-single-file-type').change( function() {
       // Enable appropriate metadata fields according to file type
       if ($(this).val() === 'BAM/SAM' || $(this).val() === 'VCF') {
           $('#edit-single-reference').attr('disabled', false);
       } else {
           $('#edit-single-reference').attr('disabled', true);
       }
       if ($(this).val() === 'Other') {
            $('#edit-single-platform, #edit-single-run-type, #edit-single-capture-kit, #edit-single-library, #edit-single-reference')
                .attr('disabled', true);
       } else {
           $('#edit-single-platform, #edit-single-run-type, #edit-single-capture-kit, #edit-single-library')
                .attr('disabled', false);
       }
    });

    $('#edit-single-readset, #edit-single-library').on('input', function (e) {
        var saveEnabled = reReadset.test($('#edit-single-readset').val()) &&
            reLibrary.test($('#edit-single-library').val());
        $('.save-edit-file').prop('disabled', !saveEnabled);
        $('#edit-single-readset')
            .closest('.form-group')
            .toggleClass('has-error', !reReadset.test($('#edit-single-readset').val()));
        $('#edit-single-library')
            .closest('.form-group')
            .toggleClass('has-error', !reLibrary.test($('#edit-single-library').val()));
    });

    $('body').on('click', '.save-edit-file', function (e) {
        fileRow.find('.file-type').text($('#edit-single-file-type').val());
        fileRow.find('.file-readset').text($('#edit-single-readset').val());
        var fileOptions = ['platform','run-type','capture-kit','library','reference'];
        jQuery.each(fileOptions, function( i, option ) {
            if ($('#edit-single-'+option).is('[disabled=disabled]')) {
                fileRow.find('.file-'+option).text('');
            } else {
                fileRow.find('.file-'+option).text($('#edit-single-'+option).val());
            }
        });
        $('#edit-file-modal').modal('hide');
    });

    $('body').on('click', '.cancel-edit-file', function (e) {
        // remove error on readset and library so it won't linger when edit file is clicked again
        $('#edit-single-readset, #edit-single-library').closest('.form-group').removeClass('has-error');
    });

    // Collapse the table contents and show only the panel header
    $('.panel-heading').on('click', function (e) {
        $(this).closest('.panel').find('.panel-body, table, .panel-footer').toggleClass('collapsed');
        if ($(this).next('.panel-body').hasClass('collapsed')) {
            $(this).find('.glyphicon').removeClass('glyphicon-triangle-bottom').addClass('glyphicon-triangle-right');
        } else {
            $(this).find('.glyphicon').removeClass('glyphicon-triangle-right').addClass('glyphicon-triangle-bottom');
        }
    });

    // Collapse samples
    $('.table-data').on('click', '.sample-collapse', function (e){
        var fileRows = $(this).closest('tr').nextUntil('.sample-header-template');
        fileRows.each(function (i, value) {
            if ($(value).hasClass('collapsed')) {
                $(value).removeClass('collapsed').css('display','table-row');
            } else {
                $(value).addClass('collapsed').css('display', 'none');
            }
        });
        var triangle = $(this).closest('tr').find('.sample-collapse.glyphicon');
        var sampleRow = $(this).closest('tr');
        if (sampleRow.hasClass('files-collapsed')) {
            sampleRow.removeClass('files-collapsed');
            triangle.removeClass('glyphicon-triangle-right').addClass('glyphicon-triangle-bottom');
        } else {
            sampleRow.addClass('files-collapsed');
            triangle.removeClass('glyphicon-triangle-bottom').addClass('glyphicon-triangle-right');
        }
    });

    // Begin uploading files
    $('.upload-sample-button').on('click', function (e) {
        if (!$(this).hasClass('disabled')) {
            $(this).hide();
            $('.modal-add-sample-button').removeClass('active').addClass('disabled');
            $('.cancel-upload, .pause-upload').show();
            //hide the options column and show the status column
            $('.sample-table td:nth-child(11), .sample-table th:nth-child(11)').toggle();
            $('.sample-table td:nth-child(10), .sample-table th:nth-child(10)').toggle();
            $('.sample-option, .file-name, .sample-name').addClass('disabled');

            r.upload();
        }
    });

    function resetSession() {
        $('.pause-upload, .resume-upload, .cancel-upload').hide();
        $('.upload-sample-button').show();
        $('.modal-add-sample-button').removeClass('disabled').addClass('active');
        //hide the options column and show the status column
        $('.sample-table td:nth-child(11), .sample-table th:nth-child(11)').toggle();
        $('.sample-table td:nth-child(10), .sample-table th:nth-child(10)').toggle();
        $('.sample-option').removeClass('disabled');
    }

    // Cancel uploading files
    $('body').on('click', '.cancel-upload', function (e){
        for (var i = 0; i < r.files.length; i++) {
            r.files[i].abort();
        }
        resetSession();
    });

    // Pause uploading files
    $('body').on('click', '.pause-upload', function (e){
        r.pause();
        $('.pause-upload, .resume-upload').toggle();
    });

    // Resume uploading files
    $('body').on('click', '.resume-upload', function (e){
        r.upload();
        $('.pause-upload, .resume-upload').toggle();
    });

    // Continue session after completed upload
    $('body').on('click', '.continue-session', function (e){
        for (var i = 0; i < r.files.length; i++) {
            r.removeFile(r.files[i]);
        }
        resetSession();
        $('tbody:first').nextUntil().remove();
        $('.upload-sample-button').addClass('disabled');
        $('#upload-complete-modal').modal('hide');
    });

    // Log out (refresh the page)
    $('body').on('click', '.logout-button', function (e){
        location.reload();
    });
});
