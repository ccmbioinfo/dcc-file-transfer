$(function () {
    var reSampleName = /^[A-Z\d\-_]+$/i;
    var reLibrary = /^[A-Z\d\-_]*$/i;
    var reReadset = reLibrary;
    var platforms = ['Illumina HiSeq', 'Illumina X10', 'SOLiDv4', 'PacBio', 'Ion Torrent', 'MinION'];
    var captureKits = ['Nextera Rapid Capture', 'Agilent SureSelect', 'NimbleGen SeqCap EZ', 'Illumina TruSeq',
        'Life Technologies TargetSeq', 'Life Technologies AmpliSeq', 'Agilent HaloPlex'];
    var referenceGenomes = ['GRCh38/hg38', 'GRCh37/hg19', 'NCBI36/hg18'];
    var fieldProperties = {
        'type': {'type': 'freetext', 'default': ''},
        'readset': {'type': 'freetext', 'default': ''},
        'run-type': {'type': 'freetext', 'default': 'N/A'},
        'library': {'type': 'freetext', 'default': ''},
        'platform': {'type': 'typeahead', 'default': ''},
        'capture-kit': {'type': 'typeahead', 'default': ''},
        'reference': {'type': 'typeahead', 'default': ''}
    };
    var fieldNames = $.map(fieldProperties, function (value, key) { return key });
    var fileExtensions = {
        '.bam': 'BAM/SAM',
        '.sam': 'BAM/SAM',
        '.sam.gz': 'BAM/SAM',
        '.fastq': 'FASTQ',
        '.fastq.gz': 'FASTQ',
        '.fq': 'FASTQ',
        '.fq.gz': 'FASTQ',
        '.bed': 'BED',
        '.vcf': 'VCF',
        '.vcf.gz': 'VCF'
    };
    var fileTypeProperties = {
        'BAM/SAM': {'fields': ['type', 'readset', 'platform', 'run-type', 'capture-kit', 'library', 'reference']},
        'FASTQ': {'fields': ['type', 'readset', 'platform', 'run-type', 'capture-kit', 'library']},
        'BED': {'fields': ['type', 'readset', 'platform', 'run-type', 'capture-kit', 'library', 'reference']},
        'VCF': {'fields': ['type', 'readset', 'platform', 'run-type', 'capture-kit', 'library', 'reference']},
        'Other': {'fields': ['type', 'readset']}
    };

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
            'sampleName': fileRow.closest('.sample-section').attr('name'),
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
                $('.transfer-code-invalid').hide();
                $('.logout').show();
            })
            .fail(function (data) {
                $('#auth-token').closest('.form-group').addClass('has-error');
                $('.transfer-code-invalid').show();
                return false;
            });
    }

    function resetSampleModal() {
        $('#add-sample-name').val('').closest('.form-group').addClass('has-error');
        $('#add-library').val('');
        $('#add-run-type').val('N/A');
        $('#add-platform, #add-capture-kit, #add-reference').typeahead('val', '');
    }

    function toggleEditableFields (fileType) {
        var editableFieldNames = fileTypeProperties[fileType]['fields'];
        for (var i = 0; i < fieldNames.length; i++) {
            var fieldName = fieldNames[i];
            var isEditable = editableFieldNames.indexOf(fieldName) >= 0;
            $('#edit-file-' + fieldName).attr('disabled', !isEditable);
        }
    }

    function createFileRow(file, sampleName) {
        var sampleTable = $('.sample-section[name="' + sampleName + '"]');
        var fileTemplate = $('.sample-file-template').first().clone();
        fileTemplate
            .attr('id', file.uniqueIdentifier)
            .find('.file-name')
            .html(file.fileName);

        sampleTable.append(fileTemplate);
        // Check for file type to determine whether metadata options should be shown
        var fileType = 'Other';
        for (var ext in fileExtensions) {
            if (fileExtensions.hasOwnProperty(ext) &&
                file.fileName.toLowerCase().indexOf(ext) > -1) {
                fileType = fileExtensions[ext];
            }
        }
        fileTemplate.find('.file-type').text(fileType);
        if (fileType !== 'Other') {
            fileTemplate.find('.file-platform').text($('#add-platform').val());
            fileTemplate.find('.file-run-type').text($('#add-run-type').find('option:selected').text());
            fileTemplate.find('.file-capture-kit').text($('#add-capture-kit').val());
            fileTemplate.find('.file-library').text($('#add-library').val());
            if (fileType !== 'FASTQ') {
                fileTemplate.find('.file-reference').text($('#add-reference').val());
            }
        }
        fileTemplate.removeClass('sample-file-template');

        // Wait until all files have been added before clearing the modal
        // Plus one to include the original cloned sample-file-template
        if ($('.sample-file-template').length === r.files.length + 1) {
            resetSampleModal();
        }
        checkUploadReady();
        $('#add-sample-modal').modal('hide');
    }

    function checkUploadReady() {
        $('.start-upload, .resume-upload').toggleClass('disabled', r.files.length === 0);
    }

    function toggleFileRows(sampleRow) {
        sampleRow.find('.sample-collapse-icon').toggle();
        sampleRow.nextUntil('.sample-header-row').toggle('fast');
    }

    function validateField(regex) {
        var isValid = regex.test($(this).val());

        $(this)
            .closest('.form-group')
            .toggleClass('has-error', !isValid);

        $(this).closest('.modal').trigger('fieldValidation');
    }

    function copyFromTableToModal(tableRow, modal) {
        for (var fieldName in fieldProperties) {
            if (fieldProperties.hasOwnProperty(fieldName)) {
                var destField = $('#edit-file-' + fieldName);
                var fieldType = fieldProperties[fieldName]['type'];
                var defaultValue = fieldProperties[fieldName]['default'];
                var sourceValue = tableRow.find('.file-' + fieldName).text() || defaultValue;
                if (fieldType === 'freetext') {
                    destField.val(sourceValue);
                } else if (fieldType === 'typeahead') {
                    destField.typeahead('val', sourceValue);
                }
            }
        }
    }

    function copyFromModalToTable(modal, tableRow) {
        for (var fieldName in fieldProperties) {
            if (fieldProperties.hasOwnProperty(fieldName)) {
                var fieldType = fieldProperties[fieldName]['type'];
                var value = '';
                var field = $('#edit-file-' + fieldName);
                if (!field.prop('disabled')) {
                    if (fieldType === 'freetext') {
                        value = field.val();
                    } else if (fieldType === 'typeahead') {
                        value = field.typeahead('val');
                    }
                }
                tableRow.find('.file-' + fieldName).text(value);
            }
        }
    }

    function showUploadStateOptions() {
        $('.cancel-upload, .progress, .resume-upload').show();
        $('.option, .start-upload').hide();
        $('.add-sample, .file-name, .resume-upload, .sample-name, .sample-option').addClass('disabled');
    }

    function hideUploadStateOptions() {
        $('.option').show();
        $('.cancel-upload, .progress').hide();
        $('.add-sample, .resume-upload, .sample-option').removeClass('disabled');
    }

    function clearTableOfCompleted () {
        var samples = $('.sample-section:first').nextUntil();

        samples.each(function (i, value) {
            if (clearSampleOfFiles($(value).attr('name')) === 0) {
                value.remove()
            }
        });
    }

    function clearSampleOfFiles(sampleName) {
        var sampleSection =  $('.sample-section[name="' + sampleName + '"]');
        var sampleRow = sampleSection.find('.sample-header-row');
        var fileRows = sampleRow.nextUntil();

        fileRows.each(function (i, value) {
            var id = $(value).attr('id');
            if (!r.getFromUniqueIdentifier(id)) {
                value.remove();
            } else {
                // rebuild resumableFile Object to initial state
                r.getFromUniqueIdentifier(id).bootstrap();
            }
        });
        return sampleRow.nextUntil().length;
    }

    function clearErrorTable() {
        $('.error-section').find('.file-error').remove();
    }

    function addFileToErrorTable (resumableFile, errorMsg) {
        var id = resumableFile.uniqueIdentifier;
        var fileErrorFields = {
            'sample': $('#' + id).closest('.sample-section').attr('name'),
            'file': resumableFile.fileName,
            'msg': errorMsg
        };

        if ($('error_'+id).length === 0) {
            var fileErrorRow = $('.file-error-template').clone();
            fileErrorRow.attr('id', 'error-' + id);

            for (var fieldName in fileErrorFields) {
                if (fileErrorFields.hasOwnProperty(fieldName)) {
                    fileErrorRow.find('.error-' + fieldName).text(fileErrorFields[fieldName])
                }
            }

            fileErrorRow.removeClass('file-error-template').addClass('file-error');
            $('.error-section').append(fileErrorRow);
        }
    }

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
        if ($('.sample-section[name="'+ sampleName +'"]').length === 0) {
            // Create a new sample section
            var sampleTemplate = $('.sample-template').first().clone();

            // Remove the file template row
            sampleTemplate.find('.sample-file-template').remove();

            sampleTemplate
                .find('.sample-name')
                .html(sampleName);

            sampleTemplate
                .attr('name', sampleName)
                .appendTo($('.table-data'));

            // Show
            sampleTemplate
                .removeClass('sample-template')
                .find('.sample-header-row')
                .removeClass('sample-header-template');
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
        // remove file from resumable
        r.removeFile(file);
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

        addFileToErrorTable(file, errorMsg);
    });

    r.on('complete', function () {
        $('#upload-complete-modal').modal('show');
        $('.error-table').toggle($('.file-error').length > 0);
    });

    $('.resumable-droparea').on({
        'dragenter': activateDropArea,
        'dragleave': deactivateDropArea,
        'dragend': deactivateDropArea,
        'drop': deactivateDropArea
    });

    //***************************************************************

    // Authentication displays upload table
    $('.auth-token-form').on('submit', function (e) {
        authorize();
        return false;
    });

    // Field validations
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

    // Set focus on first field in modal
    $('#add-sample-modal, #edit-sample-modal, #edit-file-modal').on('shown.bs.modal', function () {
        $(this).find(".form-control:first").focus();
    });

    // Enable sample name field after adding files to an existing sample
    $('#add-sample-modal').on('hide.bs.modal', function () {
        $(this).find('#add-sample-name').prop('disabled', false);
    });

    // Remove file from add sample table
    $('.table-data').on('click', '.remove-file', function (e) {
        var uniqueId = $(this).closest('.sample-file-row').attr('id');
        r.removeFile(r.getFromUniqueIdentifier(uniqueId));
        $('#'+uniqueId).remove();
    });

    // Remove entire sample from add sample table
    $('.table-data').on('click', '.remove-sample', function (e) {
        var fileRows = $(this).closest('.sample-header-row').nextUntil();

        fileRows.each(function (i, value) {
            var identifier = $(value).attr('id');
            var resumableFile = r.getFromUniqueIdentifier(identifier);
            r.removeFile(resumableFile);
        });
        fileRows.remove();
        $(this).closest('tbody').remove();
        checkUploadReady();
    });

    // Add files to a specific sample
    $('.table-data').on('click', '.add-files', function (e) {
        var sampleName = $(this).closest('tbody').attr('name');
        var sampleRow = $(this).closest('.sample-header-row');

        if (!sampleRow.nextUntil('.sample-header-row').is(':visible')) {
            toggleFileRows(sampleRow);
        }
        $('#add-sample-name').val(sampleName).prop('disabled', true).closest('.form-group').removeClass('has-error');
        $('.resumable-droparea').show();
    });

    // Open edit sample modal
    $('.table-data').on('click', '.edit-sample, .sample-name', function (e) {
        var sampleRow = $(this).closest('.sample-header-row');
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

    // Edit sample save
    $('body').on('click', '.save-edit-sample', function (e) {
        var oldName = $('#edit-sample-modal').attr('data-sample-name');
        var sampleTbody = $('tbody[name="' + oldName + '"]');
        var newName = $('#edit-sample-name').val();
        var fileRows = sampleTbody.find('.sample-header-row').nextUntil();

        sampleTbody.attr('name', newName).find('.sample-name').text(newName);
        fileRows.each(function (index) {
            var fileType = $(this).find('.file-type').text();
            var fieldNames = fileTypeProperties[fileType]['fields'];
            for (var i = 0; i < fieldNames.length; i++) {
                var fieldName = fieldNames[i];
                if ($('#edit-sample-' + fieldName).closest('.form-group').find('input[type="checkbox"]').is(':checked')) {
                    $(this).find('.file-' + fieldName).text($('#edit-sample-' + fieldName).val());
            }
}
        });
        $('#edit-sample-modal').removeAttr('data-sample-name').modal('hide');
    });

    // Edit sample cancel
    $('body').on('click', '.cancel-edit-sample', function (e) {
        // remove error on sample name so it won't linger when edit sample is clicked again
         $('#edit-sample-name').closest('.form-group').removeClass('has-error');
    });

    // Open edit file modal and populate metadata from table
    $('.table-data').on('click', '.edit-file, .file-name', function (e) {
        // Fill modal with the current file's data, and set options according to file type
        var fileRow = $(this).closest('tr');
        var fileType = fileRow.find('.file-type').text();
        var modal = $('#edit-file-modal');
        modal.attr('data-file-id', fileRow.attr('id'));
        $('.file-name-title').text(fileRow.find('.file-name').text());

        copyFromTableToModal(fileRow, modal);
        toggleEditableFields(fileType);
    });

    // Show available fields based on file type when editing
    $('#edit-file-type').change( function() {
        toggleEditableFields($(this).val())
    });

    // Save file edits to table
    $('body').on('click', '.save-edit-file', function (e) {
        var modal = $(this).closest('.modal');
        var tableRow = $('#' + modal.attr('data-file-id'));
        copyFromModalToTable(modal, tableRow);
        modal.removeAttr('data-file-id').modal('hide');
    });

    // Collapse the table contents and show only the panel header
    $('.panel-heading').on('click', function (e) {
        $(this).closest('.panel').find('.panel-body, table, .panel-footer, .collapse-icon').toggle();
    });

    // Collapse samples
    $('.table-data').on('click', '.sample-collapse', function (e){
        toggleFileRows($(this).closest('.sample-header-row'))
    });

    // Begin uploading files
    $('.start-upload').on('click', function (e) {
        if (!$(this).hasClass('disabled')) {
            showUploadStateOptions();
            r.upload();
        }
    });

    // Cancel uploading files
    $('body').on('click', '.cancel-upload', function (e){
        $('.sample-file-row[id]').each(function (i, value) {
            var resumableFile = r.getFromUniqueIdentifier($(value).attr('id'));
            if (!resumableFile){
                clearTableOfCompleted();
            } else {
                resumableFile.abort();
                $.post('/cancel', {
                'authToken': $('#auth-token').val(),
                'resumableIdentifier': resumableFile.uniqueIdentifier
            })
            }
        });
        hideUploadStateOptions();
        clearErrorTable();
    });

    // Resume uploading files
    $('body').on('click', '.resume-upload', function (e){
        for (var i = 0; i < r.files.length; i++) {
            r.files[i].retry();
        }
        showUploadStateOptions();
    });

    // Continue session after completed upload
    $('body').on('click', '.continue-session', function (e){
        hideUploadStateOptions();
        clearTableOfCompleted();
        // clear error table
        clearErrorTable();
        $('.resume-upload, .start-upload').toggle();
        $('.start-upload').addClass('disabled');
        $('#upload-complete-modal').modal('hide');
        checkUploadReady();
    });

    // Log out (refresh the page)
    $('body').on('click', '.logout-button', function (e){
        location.reload();
    });
});
