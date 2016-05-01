$(function () {
    var reSampleName = /^[A-Z\d\-_]+$/i;
    var reLibrary = /^[A-Z\d\-_]*$/i;
    var reReadset = reLibrary;
    var platforms = ['Illumina HiSeq 2500', 'Illumina HiSeq 2000', 'Illumina MiSeq', 'Illumina GE2',
        'Illumina HiSeq X Ten', 'SOLiD 4', 'SOLiD 5500'];
    var captureKits = ['Agilent SureSelect 3', 'Agilent SureSelect 4', 'Agilent SureSelect 5',
        'Agilent SureSelect Clinical Research Exome (V5)', 'Illumina TruSight One'];
    var referenceGenomes = ['GRCh38/hg38', 'GRCh37/hg19', 'NCBI36/hg18'];
    var fieldProperties = {
        'type': {'type': 'freetext', 'default': ''},
        'readset': {'type': 'freetext', 'default': ''},
        'runType': {'type': 'freetext', 'default': 'N/A'},
        'library': {'type': 'freetext', 'default': ''},
        'platform': {'type': 'typeahead', 'default': ''},
        'captureKit': {'type': 'typeahead', 'default': ''},
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
        'BAM/SAM': {'fields': ['type', 'readset', 'platform', 'runType', 'captureKit', 'library', 'reference']},
        'FASTQ': {'fields': ['type', 'readset', 'platform', 'runType', 'captureKit', 'library']},
        'BED': {'fields': ['type', 'readset', 'platform', 'runType', 'captureKit', 'library', 'reference']},
        'VCF': {'fields': ['type', 'readset', 'platform', 'runType', 'captureKit', 'library', 'reference']},
        'Other': {'fields': ['type', 'readset']}
    };
    var uploadedSampleData = {};
    var uploadedSampleNames = [];

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
        return table.find("[id='"+file.uniqueIdentifier+"']");
    }

    function getExtraParams(flowFile, flowChunk) {
        var fileRow = getFileRow(flowFile, $('.sample-table'));
        return {
            'authToken': $('#auth-token').val(),
            'sampleName': fileRow.closest('.sample-section').attr('name'),
            'fileType': fileRow.find('.file-type').text(),
            'readset': fileRow.find('.file-readset').text(),
            'platform': fileRow.find('.file-platform').text(),
            'runType': fileRow.find('.file-runType').text(),
            'captureKit': fileRow.find('.file-captureKit').text(),
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
            getSampleDataFromServer('complete')
                .done(function (sampleData) {
                    uploadedSampleData = sampleData;
                    refreshAnalysisState();
                    insertSampleDataIntoTable(sampleData, $('.dcc-table'));
                });
        }).fail(function (data) {
            $('#auth-token').closest('.form-group').addClass('has-error');
            $('.transfer-code-invalid').show();
            return false;
        });
    }

    function getSampleDataFromServer (status) {
        return $.ajax({
                    method: 'GET',
                    url: window.location.pathname + 'transfers/' + $('#auth-token').val() + '/samples/',
                    data: {'status': status}
                });
    }

    function insertSampleDataIntoTable(data, table) {
        for (var file in data) {
            createSampleHeader(data[file]['sample-name'], table);
            createFileRow(data[file]['filename'], data[file]['identifier'], data[file]['sample-name'], table);
            updateFileMetadata(data[file], table);
        }
    }

    function getUploadedSampleNames () {
        return $.unique($.map(uploadedSampleData, function (value, key) {
            return value['sample-name']
        }));
    }

    function updateFileMetadata(metadata, table) {
        var fileRow = table.find("[id='"+metadata.identifier+"']");
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
        // Set the readset, library and and runType fields to blank and N/A respectively
        $('#add-readset, #add-library').val('');
        $('#add-runType').val('N/A');
        // Set all typeahead fields to blank
        $('#add-platform, #add-captureKit, #add-reference').typeahead('val', '');
        // Set the sample/patient id field to blank and add the error class
        $('#add-sample-name').val('').closest('.form-group').show();
        validateField.call($('#add-sample-name'), reSampleName);
        validateField.call($('#add-library'), reLibrary);
        validateField.call($('#add-readset'), reReadset);
    }

    function showAdditionalFileModalOptions(isAuxiliary) {
        if (isAuxiliary) {
            $('#add-sample-name, #edit-sample-name')
                .val('~')
                .closest('.form-group')
                .removeClass('has-error');
        }
        $('#add-sample-name, #edit-sample-name')
            .prop('disabled', isAuxiliary)
            .closest('.form-group')
            .toggle(!isAuxiliary);
        $('.add-other-title, .add-other-description, .edit-other-title').toggle(isAuxiliary);
        //Show sample on False, hide on True
        $('.add-sample-title, .add-sample-description, .edit-sample-title').toggle(!isAuxiliary);
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
            // Remove the template classes
            sampleTemplate
                .attr('name', sampleName)
                .removeClass('sample-template')
                .find('.sample-header-row')
                .removeClass('sample-header-template');

            if (sampleName === '~') {
                sampleTemplate
                    .find('.sample-name')
                    .html('Additional Files');

                sampleTemplate.insertAfter(table.find('.sample-template'));
            } else {
                sampleTemplate
                    .find('.sample-name')
                    .html(sampleName);

                sampleTemplate.appendTo(table.find('.table-data'));
            }
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
            fileRow.find('.file-readset').text($('#add-readset').val());
            fileRow.find('.file-platform').text($('#add-platform').val());
            fileRow.find('.file-runType').text($('#add-runType').find('option:selected').text());
            fileRow.find('.file-captureKit').text($('#add-captureKit').val());
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
        var isValid = $(this).is(':disabled') || regex.test($(this).val());
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
        $('.sample-table').find('.option').hide();
        $('.sample-table').find('.file-name, .sample-name, .sample-option').addClass('disabled');
        $('.modal-add-sample-button, .modal-add-files-button, .start-upload').addClass('disabled');
    }

    function hideUploadStateOptions() {
        $('.sample-table').find('.option').show();
        $('.cancel-upload, .progress').hide();
        $('.sample-table').find('.file-name, .sample-name, .sample-option').removeClass('disabled');
        $('.modal-add-sample-button, .modal-add-files-button, .start-upload').removeClass('disabled');
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
            'sample': $("[id='"+id+"']").closest('.sample-section').attr('name'),
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
        getSampleDataFromServer('complete')
                .done(function (sampleData) {
                    uploadedSampleData = sampleData;
                    refreshAnalysisState();
                    insertSampleDataIntoTable(sampleData, $('.dcc-table'));
                });
        // Clear the error table of previous errors
        clearErrorTable();
        toggleUploadIfReady();
    }

    function refreshAnalysisState() {
        uploadedSampleNames = getUploadedSampleNames();
        generateTypeAheadOptions('#analysis-sample-name', uploadedSampleNames);
    }

    function generateTypeAheadOptions(input, optionList) {
        $(input).typeahead({
            hint: true,
            highlight: true,
            minLength: 1
        }, {
            source: substringMatcher(optionList)
        });

        generateTypeAheadErrorListener(input, optionList);
    }

    function generateTypeAheadErrorListener(input, optionList) {
         $(input).on('input change typeahead:selected', function (e) {
             var isValid = $.inArray($(input).val(), optionList) !== -1;
             $(input)
                 .closest('.form-group')
                 .toggleClass('has-error', !isValid)
                 .find('.error-description').toggle(!isValid);
             $(input).closest('.modal').trigger('fieldValidation');
         });
    }

    function populateAnalysisParameters() {
        var selectedSample = $('#analysis-sample-name').val();
            var readsetName = '';
            var libraryName = '';
            var runType = '';
            var BAMnames = [];
            var FASTQnames = [];

            for (var identifier in uploadedSampleData) {
                if (uploadedSampleData.hasOwnProperty(identifier)) {
                    if (uploadedSampleData[identifier]['sample-name'] === selectedSample && (uploadedSampleData[identifier]['type'] === 'FASTQ' || uploadedSampleData[identifier]['type'] === 'BAM')) {
                        var fileName = uploadedSampleData[identifier]['filename'];

                        readsetName = uploadedSampleData[identifier]['readset'];
                        libraryName = uploadedSampleData[identifier]['library'];
                        runType = uploadedSampleData[identifier]['runType'];

                        if (uploadedSampleData[identifier]['type'] === 'FASTQ') {
                            FASTQnames.push(fileName);
                        } else {
                            BAMnames.push(fileName);
                        }
                    }
                }
            }
        // populate modal and trigger field validation on modal.
        $('#analysis-readset').val(readsetName);
        $('#analysis-library').val(libraryName);
        if (runType === 'Paired End' || runType === 'Single End') {
            $('#analysis-runType').val(runType);
        }
        $('#analysis-fastq2').closest('.form-group').toggle(runType === 'Paired End');
        if (FASTQnames.length >= 2) {
            $('#analysis-fastq2').val(FASTQnames[1]);
        }
        if (FASTQnames.length >= 1) {
            $('#analysis-fastq1').val(FASTQnames[0]);
        }
        if (BAMnames.length >= 1) {
            $('#analysis-bam').val(BAMnames[0]);
        }

        //generateTypeAheadOptions('#analysis-bed', );
        generateTypeAheadOptions('#analysis-fastq1', FASTQnames);
        generateTypeAheadOptions('#analysis-fastq2', FASTQnames);
        generateTypeAheadOptions('#analysis-bam', BAMnames);
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

    function sendFileMetadata(target, data) {
        $.ajax({
            url: target,
            type: 'PUT',
            data: data
        })
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
        var sampleName = $("[id='"+uniqueIdentifier+"']").closest('.sample-section').attr('name');
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
    $('#analysis-sample-name').on('input change typeahead:selected', function (e) {
        //Sample name must match existing sample
        var isValid = $.inArray($(this).val(), uploadedSampleNames) !== -1;
        if (isValid) {
            populateAnalysisParameters();
        }
    });
    $('#analysis-runType').on('change', function (e) {
       $('#analysis-fastq2').closest('.form-group').toggle($('#analysis-runType').val() === 'Paired End');
    });
    $('#add-sample-modal').on('fieldValidation', function(e) {
        $('.flow-droparea').toggle($(this).find('.has-error').length === 0);
    });
    $('#edit-sample-modal, #edit-file-modal').on('fieldValidation', function(e) {
        $(this).find('.save-button').prop('disabled', $(this).find('.has-error').length);
    });
    $('#add-analysis-modal').on('fieldValidation', function(e) {

        // if paired end FQ1 and FQ2 no error then remove BAM error prop save changes OR BAM no error remove FQ errors and prop save changes
        // if single end FQ1 no error then remove BAM error prop save changes

        var isValid = $(this).find('.has-error').length;
        $(this).find('.save-button').prop('disabled', isValid);
        $(this).find('.analysis-parameters').toggle(!$(this).find('#analysis-sample-name').closest('.form-group').hasClass('has-error'));
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
    $('#add-captureKit, #edit-sample-captureKit, #edit-file-captureKit').typeahead({
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
    $('#add-sample-modal, #edit-sample-modal').on('hide.bs.modal', function () {
        showAdditionalFileModalOptions(false);
        resetSampleModal();
    });

    $('#edit-file-modal').on('hide.bs.modal', function () {
        resetEditFileModal();
    });

    $('body').on('click', '.modal-add-files-button', function (e) {
        $('#add-sample-modal').modal('show');
        showAdditionalFileModalOptions(true);
        $('.flow-droparea').show();
        return false;
    });

    // Remove file from add sample table
    $('.table-data').on('click', '.remove-file', function (e) {
        var uniqueId = $(this).closest('.sample-file-row').attr('id');
        flow.removeFile(flow.getFromUniqueIdentifier(uniqueId));
        $(this).closest("[id='"+uniqueId+"']").remove();

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
        $(this).closest('.sample-section').remove();
        toggleUploadIfReady();
    });

    // Add files to a specific sample
    $('.table-data').on('click', '.add-files', function (e) {
        var sampleName = $(this).closest('.sample-section').attr('name');
        if (sampleName === '~') {
            showAdditionalFileModalOptions(true);
        }
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
        var currentName = sampleRow.closest('.sample-section').attr('name');


        $('#edit-sample-name').val(currentName);

        // Show modal in data-target
        var modalId = $(this).attr('data-target');
        if (modalId) {
            $(modalId).attr('data-sample-name', currentName).modal('show');
        }
        showAdditionalFileModalOptions(currentName === '~');
        validateField.call($('#edit-sample-name'), reSampleName);
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
            if (formGroup.find('.form-control').is('#edit-sample-runType')) {
                $('#edit-sample-runType').val('N/A')
            }
        }
        if (!$('#edit-sample-name, #edit-sample-readset, #edit-sample-library').closest('.form-group').hasClass('has-error')){
            $('.save-edit-sample').prop('disabled', false);
        }
    });

    // Edit sample save
    $('body').on('click', '.save-edit-sample', function (e) {
        var oldName = $('#edit-sample-modal').attr('data-sample-name');
        var sampleTbody = $('.tab-pane.active.in').find('tbody[name="' + oldName + '"]');
        var newName = $('#edit-sample-name').val();
        var fileRows = sampleTbody.find('.sample-header-row').nextUntil();

        if (!$('#edit-sample-name').is(':disabled')) {
            sampleTbody.attr('name', newName).find('.sample-name').text(newName);
        }
        fileRows.each(function (index) {
            var fileIdentifier = $(this).attr('id');
            var fileType = $(this).find('.file-type').text();
            var fieldNames = fileTypeProperties[fileType]['fields'];
            var fileData = {
                'status': 'update',
                'identifier': fileIdentifier,
                'new-sample-name': newName,
                'fileType': fileType
            };
            for (var i = 0; i < fieldNames.length; i++) {
                var fieldName = fieldNames[i];
                if ($('#edit-sample-' + fieldName).closest('.form-group').find('input[type="checkbox"]').is(':checked')) {
                    var newValue = $('#edit-sample-' + fieldName).val();
                    $(this).find('.file-' + fieldName).text(newValue);
                    fileData[fieldName] = newValue;
                }
            }
            // If managing the sample, send update request to server on save
            if ($('.tab-pane.active.in').is('#manage')) {
                var authToken = $('#auth-token').val();
                var target = ['transfers', authToken, 'samples', oldName, 'files', fileIdentifier].join('/');
                sendFileMetadata(target, fileData);
            // If uploading the sample, update the Flow object with the correct identifier
            } else {
                var file = flow.getFromUniqueIdentifier($(this).attr('id'));
                updateIdentifier(file, newName);
                $(this).attr('id', file.uniqueIdentifier);
            }
        });
        clearTable($('.dcc-table'));
        getSampleDataFromServer('complete')
                .done(function (sampleData) {
                    uploadedSampleData = sampleData;
                    refreshAnalysisState();
                    insertSampleDataIntoTable(sampleData, $('.dcc-table'));
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
        var authToken = $('#auth-token').val();
        var modal = $(this).closest('.modal');
        var tableRow = $('.tab-pane.active.in').find("[id='"+modal.attr('data-file-id')+"']");
        var sampleName = tableRow.closest('.sample-section').attr('name');
        var fileIdentifier = tableRow.attr('id');


        if ($('.tab-pane.active.in').is('#manage')) {
            var target = ['transfers', authToken, 'samples', sampleName, 'files', fileIdentifier].join('/');
            var fileData = {
                    'status': 'update',
                    'identifier': fileIdentifier
            };
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
                        fileData[fieldName] = value;
                    }
                }
            }
            fileData['fileType'] = fileData['type'];
            sendFileMetadata(target, fileData);
        }
        copyFromModalToTable(modal, tableRow);
        clearTable($('.dcc-table'));
        getSampleDataFromServer('complete')
                .done(function (sampleData) {
                    uploadedSampleData = sampleData;
                    refreshAnalysisState();
                    insertSampleDataIntoTable(sampleData, $('.dcc-table'));
                });
        modal.removeAttr('data-file-id').modal('hide');
    });

    // Save sample analysis
    $('body').on('click', '.save-analysis', function (e) {
        //create a sample row
        var analysisTable = $('.analysis-table').find('.table-data');
        var sampleRow = analysisTable.find('.sample-analysis-row-template').clone();

        sampleRow.find('.sample-name').html($('#add-analysis-modal').find('#analysis-sample-name').val());
        sampleRow.find('.sample-readset').html($('#add-analysis-modal').find('#analysis-readset').val());
        sampleRow.find('.sample-runType').html($('#add-analysis-modal').find('#analysis-runType').val());
        sampleRow.find('.sample-library').html($('#add-analysis-modal').find('#analysis-library').val());
        sampleRow.find('.sample-pipeline').html($('#add-analysis-modal').find('#analysis-pipeline').val());
        sampleRow.find('.sample-status').html('ready');

        analysisTable.append(sampleRow);
        // Remove the template class
        sampleRow.removeClass('sample-analysis-row-template');
        $('#add-analysis-modal').modal('hide');
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
                var sampleName = $("[id='"+uniqueIdentifier+"']").closest('.sample-section').attr('name');
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

