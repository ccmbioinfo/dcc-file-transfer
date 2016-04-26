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
        $(this).toggleClass('flow-dragging', toggle);
    }

    function activateDropArea() {
        toggleDropArea.call(this, true);
    }

    function deactivateDropArea() {
        toggleDropArea.call(this, false);
    }

    function createIdentifier(file) {
        // Unique identifier includes the transfer code, sample name, file name, and file size
        var sampleName = $('#add-sample-name').val();
        var cleanFilename = file.name.replace(/[^0-9A-Z_-]/img, '');
        return $('#auth-token').val() + '_' + sampleName + '_' + cleanFilename + '_' + file.size
    }

    function updateIdentifier(file, sampleName) {
        var cleanFilename = file.name.replace(/[^0-9A-Z_-]/img, '');
        file.uniqueIdentifier = $('#auth-token').val() + '_' + sampleName + '_' + cleanFilename + '_' + file.size
    }

    function getFileRow(file, table) {
        return table.find('#'+file.uniqueIdentifier);
    }

    function getExtraParams(flowFile, flowChunk) {
        var fileRow = getFileRow(flowFile, $('.sample-table'));
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
        };
    }

    function authorize(authToken) {
        $.ajax({
                method: 'GET',
                url: window.location.pathname + 'transfers/' + authToken,
                data: {'authToken': authToken}
            }).done(function (data) {
                $('.transfer-symbol').removeClass('glyphicon-log-in').addClass('glyphicon-ok-sign');
                $('#auth-token').prop('disabled', true).closest('.form-group').removeClass('has-error');
                $('.auth-success').addClass('disabled');
                $('.main').show();
                $('.transfer-code-invalid').hide();
                $('.logout').show();
                getSampleDataFromServer('complete', $('.dcc-table'));
            })
            .fail(function (data) {
                $('#auth-token').closest('.form-group').addClass('has-error');
                $('.transfer-code-invalid').show();
                return false;
            });
    }

    function getSampleDataFromServer (status, table) {
        $.ajax({
                method: 'GET',
                url: window.location.pathname + 'transfers/' + $('#auth-token').val() + '/samples/',
                data: {'status': status}
            })
            .done(function (data) {
                for (var file in data) {
                    createSampleHeader(data[file]['sample-name'], table);
                    createFileRow(data[file]['filename'], data[file]['identifier'], data[file]['sample-name'], table);
                    updateFileMetadata(data[file], table);
                }
            })
            .fail(function (data) {
                console.log(data)
            });
    }

    function updateFileMetadata(metadata, table) {
        var fileRow = table.find('#'+metadata.identifier);
        for (var fieldName in fieldProperties) {
            if (fieldProperties.hasOwnProperty(fieldName)) {
                var fieldType = fieldProperties[fieldName]['type'];
                var value = metadata[fieldName];
                fileRow.find('.file-' + fieldName).text(value);
            }
        }
    }

    function resetEditFileModal() {
        for (var fieldName in fieldProperties) {
            if (fieldProperties.hasOwnProperty(fieldName)) {
                var destField = $('#edit-file-' + fieldName);
                var fieldType = fieldProperties[fieldName]['type'];
                var defaultValue = fieldProperties[fieldName]['default'];
                if (fieldType === 'freetext') {
                    destField.val(defaultValue);
                } else if (fieldType === 'typeahead') {
                    destField.typeahead('val', defaultValue);
                }
            }
        }
        validateField.call($('#edit-file-readset'), reReadset);
        validateField.call($('#edit-file-library'), reLibrary);
    }

    function resetSampleModal() {
       // Set the library and and run-type fields to blank and N/A respectively
        $('#add-library').val('');
        $('#add-run-type').val('N/A');
        // Set all typeahead fields to blank
        $('#add-platform, #add-capture-kit, #add-reference').typeahead('val', '');
        // Set the sample/patient id field to blank and add the error class
        $('#add-sample-name').val('');
        validateField.call($('#add-sample-name'), reSampleName);
        validateField.call($('#add-library'), reLibrary);
    }

    function toggleEditableFields (fileType) {
        var editableFieldNames = fileTypeProperties[fileType]['fields'];
        for (var i = 0; i < fieldNames.length; i++) {
            var fieldName = fieldNames[i];
            // Check if the field name is editable by looking for its index in editableFieldNames
            var isEditable = editableFieldNames.indexOf(fieldName) >= 0;
            $('#edit-file-' + fieldName).attr('disabled', !isEditable);
        }
    }

    function collapsePanel(panel) {
        panel.find('.panel-body, table, .panel-footer, .collapse-icon').toggle();
    }

    function createSampleHeader (sampleName, table) {
        // Check if sample header already exists
        if (table.find('.sample-section[name="'+ sampleName +'"]').length === 0) {
            // Create a new sample section
            var sampleTemplate = table.find('.sample-template').first().clone();
            // Remove the file template row
            sampleTemplate
                .find('.sample-file-template')
                .remove();
            // Add the sample name
            sampleTemplate
                .find('.sample-name')
                .html(sampleName);
            // Append the sample to to the table
            sampleTemplate
                .attr('name', sampleName)
                .appendTo(table.find('.table-data'));
            // Remove the template classes
            sampleTemplate
                .removeClass('sample-template')
                .find('.sample-header-row')
                .removeClass('sample-header-template');
        }
    }

    function createFileRow(fileName, uniqueIdentifier, sampleName, table) {
        var sampleTable = table.find('.sample-section[name="' + sampleName + '"]');
        var fileTemplate = table.find('.sample-file-template').first().clone();
        fileTemplate
            .attr('id', uniqueIdentifier)
            .find('.file-name')
            .html(fileName);
        // Add the template to the sampleTable
        sampleTable.append(fileTemplate);
        // Remove the template class
        fileTemplate.removeClass('sample-file-template');
    }

    function addFileMetadata (file) {
        // Check for file type to determine whether metadata options should be shown
        var fileRow = getFileRow(file, $('.sample-table'));
        var fileType = 'Other';
        for (var ext in fileExtensions) {
            if (fileExtensions.hasOwnProperty(ext) &&
                file.name.toLowerCase().indexOf(ext) > -1) {
                fileType = fileExtensions[ext];
            }
        }
        fileRow.find('.file-type').text(fileType);
        if (fileType !== 'Other') {
            fileRow.find('.file-platform').text($('#add-platform').val());
            fileRow.find('.file-run-type').text($('#add-run-type').find('option:selected').text());
            fileRow.find('.file-capture-kit').text($('#add-capture-kit').val());
            fileRow.find('.file-library').text($('#add-library').val());
            if (fileType !== 'FASTQ') {
                fileRow.find('.file-reference').text($('#add-reference').val());
            }
        }
    }

    function toggleUploadIfReady() {
        $('.start-upload').toggleClass('disabled', flow.files.length === 0);
    }

    function toggleFileRows(sampleRow) {
        sampleRow.find('.sample-collapse-icon').toggle();
        sampleRow.nextUntil('.sample-header-row').toggle('fast');
    }

    function validateField(regex) {
        var isValid = regex.test($(this).val());
        // Toggle error classes based on regex test
        $(this)
            .closest('.form-group')
            .toggleClass('has-error', !isValid)
            .find('.error-description').toggle(!isValid);
        // Trigger field validation event to check if modal has all valid fields to proceed
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
        $('.cancel-upload, .progress').show();
        $('.option').hide();
        $('.add-sample, .file-name, .sample-name, .sample-option, .start-upload').addClass('disabled');
    }

    function hideUploadStateOptions() {
        $('.option').show();
        $('.cancel-upload, .progress').hide();
        $('.add-sample, .file-name, .sample-name, .sample-option, .start-upload').removeClass('disabled');
    }

    function clearTable(table) {
        var samples = table.find('.sample-section:first').nextUntil();
        samples.each(function (i, value) {
                value.remove();
        });
    }

    function clearTableOfCompleted (table) {
        var samples = table.find('.sample-section:first').nextUntil();
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
            if (!flow.getFromUniqueIdentifier(id)) {
                value.remove();
            } else {
                // rebuild flowFile Object to initial state
                flow.getFromUniqueIdentifier(id).bootstrap();
            }
        });
        return sampleRow.nextUntil().length;
    }

    function clearErrorTable() {
        $('.error-section').find('.file-error').remove();
    }

    function addFileToErrorTable (flowFile, errorMsg) {
        var id = flowFile.uniqueIdentifier;
        var fileErrorFields = {
            'sample': $('#' + id).closest('.sample-section').attr('name'),
            'file': flowFile.name,
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

    function createTargetURL(flowFile, flowChunk, isTest) {
        var params = getExtraParams(flowFile, flowChunk);
        var urlParts = ['transfers', params.authToken, 'samples', params.sampleName, 'files',
            flowFile.uniqueIdentifier, 'chunks', flowChunk.offset + 1];
        return window.location.pathname + urlParts.join('/');
    }

    function isUploadComplete() {
        for (var i = 0; i < flow.files.length; i++) {
            if (!flow.files[i].error) {
                return false;
            }
        }
        return true;
    }

    function showUploadCompleteModal() {
        $('#upload-complete-modal').modal('show');
        $('.error-table').toggle($('.file-error').length > 0);
    }

    function refreshUploadReadyState() {
        hideUploadStateOptions();
        clearTableOfCompleted($('.sample-table'));
        // Refresh the DCC table with newly completed files
        clearTable($('.dcc-table'));
        getSampleDataFromServer('complete', $('.dcc-table'));
        // Clear the error table of previous errors
        clearErrorTable();
        toggleUploadIfReady();
    }

    function showUploadSuccess (file) {
        var fileRow = getFileRow(file, $('.sample-table'));
        fileRow.find('.progress-bar').css({
             width: '100%',
             color: 'white',
             'min-width': '2em'
        });
        fileRow.find('.progress-bar')
            .first()
            .removeClass('progress-bar-striped active')
            .html('Uploaded');
        flow.removeFile(file);
        flow.fire('fileComplete', file);
    }

    function showUploadError (file, errorReceived) {
        var fileRow = getFileRow(file, $('.sample-table'));
        var errorMsg = 'Error';
            try {
                errorMsg = $.parseJSON(errorReceived)['message'];
            } catch (e) {
            }
        fileRow.find('.progress-bar')
            .removeClass('progress-bar-striped active')
            .addClass('progress-bar-danger')
            .css({
                width: '100%'
            })
            .html(errorMsg);
        addFileToErrorTable(file, errorMsg);
        flow.fire('fileComplete', file);
    }

    //************************** FLOW OBJECT **************************

    // Create a new flow object
    var flow = new Flow({
        target: createTargetURL,
        chunkSize: 1 * 1024 * 1024,
        simultaneousUploads: 3,
        testChunks: true,
        testMethod: 'HEAD',
        uploadMethod: 'PUT',
        prioritizeFirstAndLastChunk: true,
        generateUniqueIdentifier: createIdentifier,
        query: getExtraParams,
        permanentErrors: [400, 403, 404, 415, 500, 501]
    });

    flow.assignBrowse($('.flow-browse'));

    flow.assignDrop($('.flow-droparea'));

    flow.on('fileAdded', function (flowFile) {
        var sampleName = $('#add-sample-name').val();
        var sampleTable = $('.sample-table');
        createSampleHeader(sampleName, sampleTable);
        createFileRow(flowFile.name, flowFile.uniqueIdentifier, sampleName, sampleTable);
        addFileMetadata(flowFile);
    });

    flow.on('filesSubmitted', function (file) {
        resetSampleModal();
        $('#add-sample-modal').modal('hide');
        toggleUploadIfReady();
    });

    flow.on('fileProgress', function (file) {
        var fileRow = getFileRow(file, $('.sample-table'));
        var percent = Math.floor(file.progress() * 100);

        fileRow.find('.progress-bar')
            .html(percent + '%')
            .addClass('progress-bar-striped active')
            .removeClass('progress-bar-danger');
        fileRow.find('.progress-bar').css({
            width: percent + '%'
        });
        fileRow.find('.progress-bar').css('color', 'white');
        fileRow.find('.progress-bar').css('min-width', '2em')
    });

    flow.on('fileSuccess', function (file, message) {
        var fileRow = getFileRow(file, $('.sample-table'));
        var authToken = $('#auth-token').val();
        var uniqueIdentifier = file.uniqueIdentifier;
        var sampleName = $('#'+uniqueIdentifier).closest('.sample-section').attr('name');
        var urlParts = ['transfers', authToken, 'samples', sampleName, 'files', uniqueIdentifier];
        $.ajax({
            url: window.location.pathname + urlParts.join('/'),
            type: 'PUT',
            data: {
                'status': 'complete',
                'flowFilename': file.name,
                'flowTotalSize': file.size,
                'flowTotalChunks': file.chunks.length
            }
        }).done(function () {
           showUploadSuccess(file);
        }).fail(function (response) {
            file.error = true;
            showUploadError(file, response.responseText);
        });
    });

    flow.on('fileError', function (file, message) {
        // Reflect that the file upload has resulted in error
       showUploadError(file, message);
    });

    // Custom signal that gets fired after a file is completely merged or failed
    flow.on('fileComplete', function(file) {
        // Check if all files are complete, and display modal if so
        if (isUploadComplete()) {
            showUploadCompleteModal();
        }
    });

    flow.on('complete', function () {
    });

    $('.flow-droparea').on({
        'dragenter': activateDropArea,
        'dragleave': deactivateDropArea,
        'dragend': deactivateDropArea,
        'drop': deactivateDropArea
    });

    //***************************************************************

    // Authentication displays upload table
    $('.auth-token-form').on('submit', function (e) {
        authorize($('#auth-token').val());
        // Update the DCC table with completed uploads

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
        $('.flow-droparea').toggle($(this).find('.has-error').length === 0);
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
        resetSampleModal();
        $(this).find('#add-sample-name').prop('disabled', false);
    });

    $('#edit-file-modal').on('hide.bs.modal', function () {
        resetEditFileModal();
    });

    // Remove file from add sample table
    $('.table-data').on('click', '.remove-file', function (e) {
        var uniqueId = $(this).closest('.sample-file-row').attr('id');
        flow.removeFile(flow.getFromUniqueIdentifier(uniqueId));
        $('#'+uniqueId).remove();
    });

    // Remove entire sample from add sample table
    $('.table-data').on('click', '.remove-sample', function (e) {
        var fileRows = $(this).closest('.sample-header-row').nextUntil();

        fileRows.each(function (i, value) {
            var identifier = $(value).attr('id');
            var flowFile = flow.getFromUniqueIdentifier(identifier);
            flow.removeFile(flowFile);
        });
        fileRows.remove();
        $(this).closest('tbody').remove();
        toggleUploadIfReady();
    });

    // Add files to a specific sample
    $('.table-data').on('click', '.add-files', function (e) {
        var sampleName = $(this).closest('tbody').attr('name');
        var sampleRow = $(this).closest('.sample-header-row');

        if (!sampleRow.nextUntil('.sample-header-row').is(':visible')) {
            toggleFileRows(sampleRow);
        }
        $('#add-sample-modal').modal('show');
        $('#add-sample-name').val(sampleName).prop('disabled', true);
        validateField.call($('#add-sample-name'), reSampleName);
        $('.flow-droparea').show();
        //prevents bubbling of click event to .sample-collapse parent
        return false;
    });

    // Open edit sample modal
    $('.table-data').on('click', '.edit-sample, .sample-name', function (e) {
        var sampleRow = $(this).closest('.sample-header-row');
        var currentName = sampleRow.find('.sample-name').text();
        $('#edit-sample-name').val(currentName);
        validateField.call($('#edit-sample-name'), reSampleName);
        // Show modal in data-target
        var modalId = $(this).attr('data-target');
        if (modalId) {
            $(modalId).attr('data-sample-name', currentName).modal('show');
        }
        return false;
    });

    // Enable editing of metadata options on entire sample
    $('input:checkbox').change( function() {
        var formGroup = $(this).closest('.form-group');
        if ($(this).is(':checked')) {
            formGroup.find('.form-control').attr('disabled', false);
        } else {
            formGroup.removeClass('has-error').find('.form-control').val('').attr('disabled',true);
            formGroup.find('.error-description').hide();
            if (formGroup.find('.form-control').is('#edit-sample-run-type')) {
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
        var sampleTbody = $('.sample-table').find('tbody[name="' + oldName + '"]');
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
            var file = flow.getFromUniqueIdentifier($(this).attr('id'));
            updateIdentifier(file, newName);
            $(this).attr('id', file.uniqueIdentifier);
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
       collapsePanel($(this).closest('.panel'))
    });

    // Collapse samples
    $('.table-data').on('click', '.sample-collapse', function (e){
        toggleFileRows($(this).closest('.sample-header-row'))
    });

    // Begin uploading files
    $('.start-upload').on('click', function (e) {
        if (!$(this).hasClass('disabled')) {
            clearErrorTable();
            showUploadStateOptions();
            // flow.upload() was used originally, but to allow resuming, this was changed to flow.file.retry()
            $.each(flow.files, function (i, file) {
                var authToken = $('#auth-token').val();
                var uniqueIdentifier = file.uniqueIdentifier;
                var sampleName = $('#'+uniqueIdentifier).closest('.sample-section').attr('name');
                var urlParts = ['transfers', authToken, 'samples', sampleName, 'files', uniqueIdentifier];
                var fileData = {
                    'status': 'start',
                    'flowFilename': file.name,
                    'flowTotalSize': file.size,
                    'flowTotalChunks': file.chunks.length
                };
                var data = getExtraParams(file);
                for (var attrname in fileData) { data[attrname] = fileData[attrname]; }
                (function (file) {
                    $.ajax({
                        url: window.location.pathname + urlParts.join('/'),
                        type: 'PUT',
                        data: data
                    }).done(function () {
                        file.bootstrap();
                        file.resume();
                    }).fail(function (error) {
                        if (error.status === 400) {
                            var fileRow = getFileRow(file, $('.sample-table'));
                            // Show upload success since status 400 indicates file already uploaded
                            showUploadSuccess(file);
                        }
                    });
                })(file);
            })
        }
    });

    // Cancel uploading files
    $('body').on('click', '.cancel-upload', function (e){
        $('.sample-file-row[id]').each(function (i, value) {
            var flowFile = flow.getFromUniqueIdentifier($(value).attr('id'));
            if (flowFile !== false){
                flowFile.pause();
                var authToken = $('#auth-token').val();
                var sampleName = $(value).closest('.sample-section').attr('name');
                var urlParts = ['transfers', authToken, 'samples', sampleName, 'files', flowFile.uniqueIdentifier];
                $.ajax({
                    url: window.location.pathname + urlParts.join('/'),
                    type: 'DELETE'
                })
            }
        });
        refreshUploadReadyState();
    });

    // Continue session after completed upload
    $('body').on('click', '.continue-session', function (e){
        refreshUploadReadyState();
        $('#upload-complete-modal').modal('hide');
    });

    // Log out (refresh the page)
    $('body').on('click', '.logout-button', function (e){
        document.location.reload();
    });
});
