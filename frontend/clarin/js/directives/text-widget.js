angular.module('clarin-el').directive('textWidget', [ '$q', '$ocLazyLoad', 'TextWidgetAPI', 'RestoreAnnotation', 'Document', 'OpenDocument', 'ButtonColor', 'CoreferenceColor', 'Dialog',
	function($q, $ocLazyLoad, TextWidgetAPI, RestoreAnnotation, Document, OpenDocument, ButtonColor, CoreferenceColor, Dialog) {
    function ColorLuminance (col, amt) {
        var usePound = true;
  
        if (col[0] == "#") {
            col = col.slice(1);
            usePound = true;
        }
     
        var num = parseInt(col,16);
        var r = (num >> 16) + amt;
        if (r > 255) r = 255;
        else if  (r < 0) r = 0;
     
        var b = ((num >> 8) & 0x00FF) + amt;
        if (b > 255) b = 255;
        else if  (b < 0) b = 0;
     
        var g = (num & 0x0000FF) + amt;
        if (g > 255) g = 255;
        else if (g < 0) g = 0;
     
        return (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16);
    }

    return {
        restrict: 'E',
        replace: true,
        scope: {},
        template: '<textarea id="text-widget"></textarea>',
        link: function (scope, elem, attrs) {
            var mainContent = document.getElementsByClassName("main-content")[0];
            var editor = CodeMirror.fromTextArea(document.getElementById("text-widget"), {
              	lineNumbers: false,
              	dragDrop: false,
              	readOnly: true,
              	theme: "night",
              	lineWrapping: true,
              	cursorBlinkRate: -1,
             	viewportMargin: Infinity,
              	extraKeys: {}
            });

            var getSelectionInfo = function() {
                var start=0, end=0;
                var selection = {
                    startOffset: -1, 
                    endOffset: -1,
                    segment: ""
                };
                
                var totalDocLines = editor.lineCount();
                var editorSelectionStart = editor.getCursor("from");
                var editorSelectionEnd = editor.getCursor("to");
                var editorSegment = editor.getSelection();

                if (!angular.isUndefined(editorSelectionStart) && !angular.isUndefined(editorSelectionEnd)) {
                    for (var i=0; i<totalDocLines; i++) {
                        var lineLength = editor.getLine(i).length;
                        end = start + lineLength;

                        if (selection.startOffset==-1 && angular.equals(i, editorSelectionStart.line))
                            selection.startOffset = start + editorSelectionStart.ch;

                        if (selection.startOffset!=-1 && angular.equals(i, editorSelectionEnd.line)) {
                            selection.endOffset = start + editorSelectionEnd.ch;
                            selection.segment = editorSegment;
                            break;
                        }
            
                        start = end;
                    }
                }

                return selection;
            };

            var computeSelectionFromOffsets = function (startOffset, endOffset) {
                var start=0, end=0;
                var selection = {
                    start : {
                        line : -1,
                        ch : -1
                    },
                    end : {
                        line : -1,
                        ch : -1
                    }
                };
                var totalDocLines = editor.lineCount();

                for (var i=0; i<totalDocLines; i++) {
                    var lineLength = editor.getLine(i).length;
                    end = start + lineLength;

                    if (startOffset>=start && startOffset<=end && selection.start.line==-1) {
                        selection.start.line = i;
                        selection.start.ch = startOffset - start;
                    }

                    if (endOffset>=start && endOffset<=end && selection.end.line==-1) {
                        selection.end.line = i;
                        selection.end.ch = endOffset - start;
                        break;
                    }

                    start = end;
                }

                return selection;
            };

         	var mouseUpHandler = function(e) {
                /*  if(TextWidgetAPI.isRunning
                        return false; */

               /* var ua = window.navigator.userAgent;
                if (!(ua.indexOf("MSIE ") > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./) || ua.indexOf('Firefox')>-1)) {
                	e.stopPropagation();
                }*/
                
                if (e.button === 0) {   //left button click 
                    var selection = getSelectionInfo();

                    if (!angular.equals(selection,{})) {
                        TextWidgetAPI.setCurrentSelection(selection, false);

                        if (angular.equals(selection.segment, "")) {              //point selection
                            var editorSelection = computeSelectionFromOffsets(selection.startOffset, selection.startOffset);       //transform selection from absolute to cm format
                            var availableAnnotationsOnCursor = editor.findMarksAt(editorSelection.start, editorSelection.end);     //find available marks at the position of the cursor
                            var availableAnnotationsLength = availableAnnotationsOnCursor.length;

                            if (availableAnnotationsLength> 0) {
                                var selectedAnnotation = TextWidgetAPI.getAnnotationById(availableAnnotationsOnCursor[availableAnnotationsLength-1].className);   //search for the annotation using its id

                                if (!angular.isUndefined(selectedAnnotation)) {
                                    TextWidgetAPI.setSelectedAnnotation(selectedAnnotation);
                                    TextWidgetAPI.computeOverlappingAreas(selection.startOffset);
                                    return false;
                                }
                            }
                        } 
                            
                        TextWidgetAPI.clearSelectedAnnotation();
                    } 
                } else if (e.button === 1) {    //middle button click 
                    e.preventDefault();
                    var updatedSelection = {};
                    var savedSelection = TextWidgetAPI.getCurrentSelection();

                    var editorCursor = editor.getCursor("from");
                    var word = editor.findWordAt(editorCursor);
                    editor.setSelection(word.anchor, word.head);
                    var currentSelection = getSelectionInfo();

                    if (angular.isUndefined(savedSelection) || angular.equals(savedSelection, {}) || savedSelection.segment.length==0)
                        TextWidgetAPI.setCurrentSelection(currentSelection, false);
                    else if (savedSelection.segment.length>0){
                        if (currentSelection.startOffset < savedSelection.startOffset)
                            updatedSelection = computeSelectionFromOffsets(currentSelection.startOffset, savedSelection.endOffset);
                        else if (currentSelection.endOffset > savedSelection.endOffset) 
                            updatedSelection = computeSelectionFromOffsets(savedSelection.startOffset, currentSelection.endOffset);
                        else 
                            updatedSelection = currentSelection; 

                        editor.setSelection(updatedSelection.start, updatedSelection.end);
                        currentSelection = getSelectionInfo();
                        if (!angular.equals(currentSelection.segment, ""))
                            TextWidgetAPI.setCurrentSelection(currentSelection, false);   
                    }
                } else
                	TextWidgetAPI.clearSelection();
            };

            /*** When a document changes bring the text and the annotations ***/
            var updateCurrentDocument = function () {
                /*if(!TextWidgetAPI.isRunning())
                  TextWidgetAPI.enableIsRunning();
                else 
                  return false;*/

                var newDocument = TextWidgetAPI.getCurrentDocument();
                var curCol = TextWidgetAPI.getCurrentCollection();

                if (!angular.equals({}, newDocument)) {   //if new document is not empty
                	var documentData = {
                		document_id : newDocument.id,
                		collection_id : newDocument.collection_id,
                		annotator_type : TextWidgetAPI.getAnnotatorType()
                	};

                	OpenDocument.save(documentData)
          			.then(function(response){   
	            		if (response.success)
							return Document.get(newDocument.collection_id, newDocument.id)	//get document's data						
	            		else
	              			return $q.reject();
          			}).then(function(response) {
                        if(!response.success) {
                            TextWidgetAPI.disableIsRunning();
                            var modalOptions = { body: 'Error during the restore of your document. Please refresh the page and try again.' };
                            Dialog.error(modalOptions);
                        } else {
                        	TextWidgetAPI.resetData();
                            editor.refresh();
                            editor.setValue(response.data.text);

                            if (response.data.is_opened) {                          	
                                RestoreAnnotation.restoreFromTemp(newDocument.collection_id, newDocument.id)
                                .then(function(response) {
                                    TextWidgetAPI.disableIsRunning();

                                    if(!response.success) {
                                        var modalOptions = { body: 'Error during the restore of your annotations. Please refresh the page and try again.' };
                                        Dialog.error(modalOptions);
                                    } else 
                                        TextWidgetAPI.matchAnnotationsToSchema(response.data);
                                });
                            } else {
                                RestoreAnnotation.restoreFromDB(newDocument.collection_id, newDocument.id)
                                .then(function(response) {
                                    TextWidgetAPI.disableIsRunning();

                                    if(!response.success) {
                                        var modalOptions = { body: 'Error during the restore of your annotations. Please refresh the page and try again.' };
                                        Dialog.error(modalOptions);
                                    } else 
                                        TextWidgetAPI.matchAnnotationsToSchema(response.data);
                                });
                            }
                        } 
                    }, function(error){
                        TextWidgetAPI.disableIsRunning();
                        var modalOptions = { body: 'Database error. Please refresh the page and try again.' };
                        Dialog.error(modalOptions);
                    });
                } else 
                    TextWidgetAPI.disableIsRunning();
            };

            var clearDuplicateAnnotationsFromEditor = function (newAnnotations) {
                var editorMarks = editor.getAllMarks();

                for(var i=0; i<newAnnotations.length; i++) {
                    for(var j=0; j<editorMarks.length; j++) {
                        if (String(newAnnotations[i].annotation._id).indexOf(editorMarks[j].className)>-1) {
                            editorMarks[j].clear();
                        }
                    }
                }
            };


            /*************************************************************************************/
            /**        Function to visualize the annotations to the text widget                 **/
            /*************************************************************************************/
            var visualizeAnnotations = function(newAnnotations, annotatorType) {    
                if (angular.isUndefined(newAnnotations) || newAnnotations.length == 0) return false;
                
                clearDuplicateAnnotationsFromEditor(newAnnotations);                       // if there are any borders around a specific annotation, remove them.
                
                for (var k=0; k<newAnnotations.length; k++){    // if there are new annotations to be visualised, add them to the editor
                    for (var l=0; l<newAnnotations[k].annotation.spans.length; l++){   // Iterate through annotations spans
                        var colorCombination = {};
                        var annotationSpan = newAnnotations[k].annotation.spans[l];
                        var annotationsAttributes = newAnnotations[k].annotation.attributes;

                        switch (annotatorType) {
                          case "Button Annotator":              // If it is Button Annotator get the required color combination
                            for (var m=0; m<annotationsAttributes.length; m++) {
                                colorCombination = ButtonColor.getColorCombination(annotationsAttributes[m].value);
                                if (!angular.isUndefined(colorCombination)) 
                                    break; 
                            }
                            break;
                          case "Coreference Annotator":         // If it is Coreference Annotator get the required color combination
                            colorCombination = CoreferenceColor.getColorCombination(newAnnotations[k].annotation._id);
                            break;
                        }                  

                        // create the selection in the editor and annotatate it 
                        var selection = computeSelectionFromOffsets(parseInt(annotationSpan.start), parseInt(annotationSpan.end));

                        if (!angular.isUndefined(newAnnotations[k].selected) && newAnnotations[k].selected) {
                            var borderColor = ColorLuminance (colorCombination.bg_color, 100);
                            editor.markText(selection.start, selection.end, { className: newAnnotations[k].annotation._id,
                                                                              css: "color:" + colorCombination.fg_color + "; " +
                                                                                   "background:" + colorCombination.bg_color + "; " +
                                                                                   "border: 2px ridge "+ borderColor + ";"
                                                                            });
                        } else { 
                            editor.markText(selection.start, selection.end, { className: newAnnotations[k].annotation._id,
                                                                              css: "color:" + colorCombination.fg_color + "; " +
                                                                                   "background:" + colorCombination.bg_color + ";"
                                                                            }); 
                        }
                    }
                }

                TextWidgetAPI.clearAnnotationsToBeAdded();
            };


            /*************************************************************************************/
            /**                   Function to add annotation to the text widget                 **/
            /*************************************************************************************/
            var addNewAnnotations = function() { 
                if (!TextWidgetAPI.isRunning())
                  	TextWidgetAPI.enableIsRunning();
                else 
                  	return false;

                var newAnnotations = TextWidgetAPI.getAnnotationsToBeAdded();
                var annotatorType = TextWidgetAPI.getAnnotatorType();

                if (!angular.isUndefined(newAnnotations) && newAnnotations.length>0)             
                    visualizeAnnotations(newAnnotations, annotatorType);

                TextWidgetAPI.disableIsRunning();
            };


            /*************************************************************************************/
            /**                Function to remove annotation from the text widget               **/
            /*************************************************************************************/
            var deleteAnnotations = function() {
                if(!TextWidgetAPI.isRunning()) //check if running
                  	TextWidgetAPI.enableIsRunning();
                else 
                  	return false;

                var annotationsToBeDeleted = TextWidgetAPI.getAnnotationsToBeDeleted();
                if (angular.isUndefined(annotationsToBeDeleted) || annotationsToBeDeleted.length==0) {
                    TextWidgetAPI.disableIsRunning();
                    return false;
                }

                for (var m=0; m<annotationsToBeDeleted.length; m++) {
                    var editorMarks = editor.getAllMarks();
                    for(var i=0; i<editorMarks.length; i++) {
                        if (angular.equals(String(annotationsToBeDeleted[m]._id).trim(), String(editorMarks[i].className).trim()))
                            editorMarks[i].clear();
                    }
                }

                TextWidgetAPI.clearAnnotationsToBeDeleted();
                TextWidgetAPI.disableIsRunning();
            };

            var updateCurrentSelection = function() { 
                var currentSel = TextWidgetAPI.getCurrentSelection();
                
                if (angular.isUndefined(currentSel)) 
                	return;
                else if (angular.equals(currentSel, {}))
            		editor.setCursor({line:0, ch:0});
            	else {
            		var sel = computeSelectionFromOffsets(parseInt(currentSel.startOffset), parseInt(currentSel.endOffset));
            		editor.setSelection(sel.start, sel.end);
            	}
            };

            CodeMirror.on(mainContent, "mouseup", mouseUpHandler);
            TextWidgetAPI.registerCurrentDocumentCallback(updateCurrentDocument); 
            TextWidgetAPI.registerCurrentSelectionCallback(updateCurrentSelection);
            TextWidgetAPI.registerNewAnnotationsCallback(addNewAnnotations);
            TextWidgetAPI.registerDeletedAnnotationsCallback(deleteAnnotations);
        
            scope.$on('$destroy', function () { 
            	editor.toTextArea();
            	CodeMirror.off(mainContent, "mouseup", mouseUpHandler); 
            });
        }      
    }
}]);