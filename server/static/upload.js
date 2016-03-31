$(function () {
    var reSampleName = /^[A-Z\d\-_]+$/i;
    var reLibrary = /^[A-Z\d\-_]*$/i;
    var reReadset = reLibrary;

    //************************** RESUMABLE **************************

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

    r.assignDrop($('.resumable-droparea'));

    r.assignBrowse($('.resumable-browse'));

    r.on('fileAdded', function (file) {
        var sampleName = $('#add-sample-name').val();
        // Check if sample header already exists
        if ($('tbody[name="'+ sampleName +'"]').length === 0) {
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
        createFileRow(file, sampleName);
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
    });

    $('.resumable-droparea').on({
        'dragenter': activateDropArea,
        'dragleave': deactivateDropArea,
        'dragend': deactivateDropArea,
        'drop': deactivateDropArea
    });

    function toggleDropArea(toggle) {
        $(this).toggleClass('resumable-dragging', toggle);
    }

    function activateDropArea() {
        toggleDropArea.call(this, true);
    }

    function deactivateDropArea() {
        toggleDropArea.call(this, false);
    }

    function createIdentifier(file) {
        // Unique identifier includes the transfer code, sample name, file name, and file size
        var sample = $('#add-sample-name').val();
        var cleanFilename = file.name.replace(/[^0-9A-Z_-]/img, '');
        return $('#auth-token').val()+'_'+sample+'_'+cleanFilename+'_'+file.size
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

    function resetSampleModal() {
        $('#add-sample-name').val('').closest('.form-group').addClass('has-error');
        $('#add-library').val('');
        $('#add-run-type').val('N/A');
        $('#add-platform, #add-capture-kit, #add-reference').typeahead('val', '');
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
                         '.fastq': 'FASTQ/FQ',
                         '.fastq.gz': 'FASTQ/FQ',
                         '.fq': 'FASTQ/FQ',
                         '.fq.gz': 'FASTQ/FQ',
                         '.bed': 'BED',
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
            if (fileType !== 'FASTQ/FQ') {
                fileTemplate.find('.file-reference').text($('#add-reference').val());
            }
        }
        fileTemplate.show();

        // Wait until all files have been added before clearing the modal
        // Plus one to include the original cloned sample-file-template
        if ($('.sample-file-template').length === r.files.length + 1) {resetSampleModal()};
        checkUploadReady();
        $('#add-sample-modal').modal('hide');
        $('.resumable-droparea').hide();
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
    $('.login').on('click', function() {authorize()});


    // Submitting a sample name will open the drop area and enable name editing
    function validateField(regex) {
        var isValid = regex.test($(this).val());

        $(this)
            .closest('.form-group')
            .toggleClass('has-error', !isValid);

        $(this).closest('.modal').trigger('fieldValidation');
    }

    $('.field-sample-name').on('input', function (e) {
        validateField.call(this, reSampleName);
    });
    $('.field-readset').on('input', function (e) {
        validateField.call(this, reReadset);
    });
    $('.field-library').on('input', function (e) {
        validateField.call(this, reLibrary);
    });
    $('#add-sample-modal').on('fieldValidation', function(e) {
        $('.resumable-droparea').toggle($(this).find('.has-error').length === 0);
    });
    $('#edit-sample-modal, #edit-file-modal').on('fieldValidation', function(e) {
        $('.save-edit-button').prop('disabled', $(this).find('.has-error').length);
    });

    // Platform typeahead
    $('#add-platform, #edit-sample-platform, #edit-file-platform').typeahead({
        hint: true,
        highlight: true,
        minLength: 1
    },{
        name: 'Platforms',
        source: substringMatcher(platforms)
    });

    // Capture Kit typeahead
    $('#add-capture-kit, #edit-sample-capture-kit, #edit-file-capture-kit').typeahead({
        hint: true,
        highlight: true,
        minLength: 1
    },{
        name: 'CaptureKits',
        source: substringMatcher(captureKits)
    });

    // Reference genome typeahead
    $('#add-reference, #edit-sample-reference, #edit-file-reference').typeahead({
        hint: true,
        highlight: true,
        minLength: 1
    },{
        name: 'referenceGenomes',
        source: substringMatcher(referenceGenomes)
    });

    // Remove file from add sample table
    $('.table-data').on('click', '.remove-file', function (e) {
        var uniqueId = $(this).closest('tr').attr('id');
        r.removeFile(r.getFromUniqueIdentifier(uniqueId));
        $('#'+uniqueId).remove();
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
        $('#add-sample-name').prop('disabled', false);
    });

    // Add files to a specific sample
    $('.table-data').on('click', '.add-files', function (e) {
        var sampleName = $(this).closest('tbody').attr('name');
        $('#add-sample-name').val(sampleName).prop('disabled', true).closest('.form-group').removeClass('has-error');
        $('.resumable-droparea').show();
    });


    // Edit entire sample data
    $('.table-data').on('click', '.edit-sample, .sample-name', function (e) {
        var sampleRow = $(this).closest('.sample-row');
        var currentName = sampleRow.find('.sample-name').text();
        $('#edit-sample-name').val(currentName);
        // Show modal in data-target
        var modalId = $(this).attr('data-target');
        if (modalId) {
            $(modalId).attr('data-sample-name', currentName).modal('show');
        }
        return false;
    });

    // Enable editing of metadata options on entire sample
    $('input:checkbox').change( function() {
        if ($(this).is(':checked')) {
            $(this).closest('.form-group').find('.form-control').attr('disabled', false);
        } else {
            $(this).closest('.form-group').removeClass('has-error').find('.form-control').val('').attr('disabled',true);
            if ($(this).closest('.form-group').find('.form-control').is('#edit-sample-run-type')) {
                $('#edit-sample-run-type').val('N/A')
            }
        }
        if (!$('#edit-sample-name, #edit-sample-readset, #edit-sample-library').closest('.form-group').hasClass('has-error')){
            $('.save-edit-sample').prop('disabled', false);
        }
    });

    $('body').on('click', '.save-edit-sample', function (e) {
        var oldName = $('#edit-sample-modal').attr('data-sample-name');
        var sampleTbody = $('tbody[name="' + oldName + '"]');
        var newName = $('#edit-sample-name').val();
        var fileRows = sampleTbody.find('.sample-row').nextUntil();

        sampleTbody.attr('name', newName).find('.sample-name').text(newName);
        fileRows.each(function (index) {
            var fileType = $(this).find('.file-type').text();
            var fieldNames = ['readset'];
            if (fileType !== 'Other') {
                fieldNames.push('platform', 'run-type', 'capture-kit', 'library');
            }
            if (fileType === 'BAM/SAM' || fileType === 'VCF' || fileType === 'BED') {
                fieldNames.push('reference');
            }

            for (var i = 0; i < fieldNames.length; i++) {
                var fieldName = fieldNames[i];
                if ($('#edit-sample-' + fieldName).closest('.form-group').find('input[type="checkbox"]').is(':checked')) {
                    $(this).find('.file-' + fieldName).text($('#edit-sample-' + fieldName).val());
            }
}
        });
        $('#edit-sample-modal').removeAttr('data-sample-name').modal('hide');
    });
    $('body').on('click', '.cancel-edit-sample', function (e) {
        // remove error on sample name so it won't linger when edit sample is clicked again
         $('#edit-sample-name').closest('.form-group').removeClass('has-error');
    });

    // Edit file data
    function toggleEditableFields (fileType) {
        $('.edit-field').attr('disabled', fileType === 'Other');
        $('#edit-file-reference').attr('disabled', fileType === 'FASTQ/FQ' || fileType === 'Other');
        var single_run_type = $('#edit-file-run-type');
        if (single_run_type.val() === null) {
            single_run_type.val('N/A')
        }
    }

    $('.table-data').on('click', '.edit-file, .file-name', function (e) {
        // Fill modal with the current file's data, and set options according to file type
        var fileRow = $(this).closest('tr');
        var fileType = fileRow.find('.file-type').text();

        $('#edit-file-modal').attr('data-file', fileRow.attr('id'));
        $('.file-name-title').text(fileRow.find('.file-name').text());
        $('#edit-file-file-type').val(fileType);

        var fields = {
            'readset': 'freetext',
            'run-type': 'freetext',
            'library': 'freetext',
            'platform': 'typeahead',
            'capture-kit': 'typeahead',
            'reference': 'typeahead'
        };
        for (var fieldName in fields) {
            if (fields.hasOwnProperty(fieldName)) {
                var editField = $('#edit-file-' + fieldName);
                var tableValue = fileRow.find('.file-' + fieldName).text();
                var fieldType = fields[fieldName];
                if (fieldType === 'freetext') {
                    editField.val(tableValue);
                } else if (fieldType === 'typeahead') {
                    editField.typeahead('val', tableValue);
                }
            }
        }

        toggleEditableFields(fileType);
    });

    $('#edit-file-file-type').change( function() {
        toggleEditableFields($(this).val())
    });

    $('body').on('click', '.save-edit-file', function (e) {
        var fileRow = $('#'+$('#edit-file-modal').attr('data-file'));

        fileRow.find('.file-type').text($('#edit-file-file-type').val());
        fileRow.find('.file-readset').text($('#edit-file-readset').val());
        var fileOptions = ['platform','run-type','capture-kit','library','reference'];
        for (var i = 0; i < fileOptions.length; i++) {
            var option = fileOptions[i];
            if ($('#edit-file-'+option).is('[disabled=disabled]')) {
                fileRow.find('.file-'+option).text('');
            } else {
                fileRow.find('.file-'+option).text($('#edit-file-'+option).val());
            }
        }
        $('#edit-file-modal').removeAttr('data-file').modal('hide');
        $('.edit-field').attr('disabled', false);
    });

    $('body').on('click', '.cancel-edit-file', function (e) {
        // Reset modal to default cleared state
        $('.edit-field').attr('disabled', false);
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
            $('.cancel-upload, .resume-upload').show();
            //hide the options column and show the status column
            $('.sample-table td:nth-child(11), .sample-table th:nth-child(11)').toggle();
            $('.sample-table td:nth-child(10), .sample-table th:nth-child(10)').toggle();
            $('.sample-option, .file-name, .sample-name').addClass('disabled');

            r.upload();
        }
    });

    function resetSession() {
        $('.pause-upload, .cancel-upload').hide();
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
            $.post('/cancel', {
                'authToken': $('#auth-token').val(),
                'resumableIdentifier': r.files[i].uniqueIdentifier
            })

        }
        resetSession();
        $('.resume-upload').removeClass('disabled');
    });

    // Resume uploading files
    $('body').on('click', '.resume-upload', function (e){
        for (var i = 0; i < r.files.length; i++) {
            r.files[i].retry();
        }
        $(this).addClass('disabled');
        $('.modal-add-sample-button').removeClass('active').addClass('disabled');
        $('.cancel-upload, .resume-upload').show();
        //hide the options column and show the status column
        $('.sample-table td:nth-child(11), .sample-table th:nth-child(11)').toggle();
        $('.sample-table td:nth-child(10), .sample-table th:nth-child(10)').toggle();
        $('.sample-option, .file-name, .sample-name').addClass('disabled');
    });

    // Continue session after completed upload
    $('body').on('click', '.continue-session', function (e){
        for (var i = 0; i < r.files.length; i++) {
            r.removeFile(r.files[i]);
        }
        resetSession();

        $('tbody:first').nextUntil().remove();
        $('.resume-upload').hide().addClass('disabled');
        $('.upload-sample-button').show().addClass('disabled');
        $('#upload-complete-modal').modal('hide');
    });

    // Log out (refresh the page)
    $('body').on('click', '.logout-button', function (e){
        location.reload();
    });
});
