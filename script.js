// Configuración de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

class PDFInputEditor {
    constructor() {
        this.pdf = null;
        this.originalPdfBytes = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.5;
        this.canvas = null;
        this.context = null;
        this.isAddingField = false;
        this.inputs = [];
        this.inputCounter = 0;
        this.selectedInput = null;
        this.dragData = null;
        this.pendingFieldPosition = null;
        this.loadedYaml = null; // Almacenar YAML cargado

        this.init();
    }

    init() {
        this.zoomLevel = 100;
        this.minZoom = 25;
        this.maxZoom = 400;
        this.setupElements();
        this.setupEventListeners();
        
        // Bloquear botón de PDF inicialmente
        this.elements.uploadBtn.disabled = true;
        this.elements.addFieldBtn.disabled = true;
        this.elements.savePdfBtn.disabled = true;
        
        // Debug: verificar elementos importantes
        console.log('Elements check:', {
            zoomIn: !!this.elements.zoomInBtn,
            zoomOut: !!this.elements.zoomOutBtn,
            fitPage: !!this.elements.fitPageBtn,
            zoomLevel: !!this.elements.zoomLevel,
            pdfContainer: !!this.elements.pdfContainer,
            createFieldBtn: !!this.elements.createFieldBtn,
            newFieldModal: !!this.elements.newFieldModal
        });
    }

    updateFieldsInfo() {
        const fieldsInfoElement = document.getElementById('fieldsInfo');
        if (this.inputs.length > 0) {
            const existingCount = this.inputs.filter(input => input.isExisting).length;
            const newCount = this.inputs.filter(input => !input.isExisting).length;
            const currentPageFields = this.inputs.filter(input => input.page === this.currentPage).length;
            
            fieldsInfoElement.textContent = `${existingCount} existentes + ${newCount} nuevos (${currentPageFields} en esta página)`;
            fieldsInfoElement.style.display = 'inline';
            
            // Mostrar botón de limpiar campos si hay campos
            if (this.elements.clearFieldsBtn) {
                this.elements.clearFieldsBtn.style.display = 'inline-flex';
                this.elements.clearFieldsBtn.disabled = false;
            }
        } else {
            fieldsInfoElement.style.display = 'none';
            
            // Ocultar botón de limpiar campos si no hay campos
            if (this.elements.clearFieldsBtn) {
                this.elements.clearFieldsBtn.style.display = 'none';
            }
        }
    }

    setupElements() {
        // Referencias a elementos DOM
        this.elements = {
            pdfInput: document.getElementById('pdfInput'),
            yamlInput: document.getElementById('yamlInput'),
            uploadBtn: document.getElementById('uploadBtn'),
            loadYamlBtn: document.getElementById('loadYamlBtn'),
            addFieldBtn: document.getElementById('addFieldBtn'),
            savePdfBtn: document.getElementById('savePdfBtn'),
            newPdfBtn: document.getElementById('newPdfBtn'),
            fileName: document.getElementById('fileName'),
            yamlStatus: document.getElementById('yamlStatus'),
            pageInfo: document.getElementById('pageInfo'),
            fieldsInfo: document.getElementById('fieldsInfo'),
            pdfViewer: document.getElementById('pdfViewer'),
            navigation: document.getElementById('navigation'),
            prevPage: document.getElementById('prevPage'),
            nextPage: document.getElementById('nextPage'),
            pageNum: document.getElementById('pageNum'),
            pageCount: document.getElementById('pageCount'),
            contextMenu: document.getElementById('contextMenu'),
            propertiesPanel: document.getElementById('propertiesPanel'),
            inputName: document.getElementById('inputName'),
            inputValue: document.getElementById('inputValue'),
            inputType: document.getElementById('inputType'),
            inputWidth: document.getElementById('inputWidth'),
            inputHeight: document.getElementById('inputHeight'),
            applyProperties: document.getElementById('applyProperties'),
            cancelProperties: document.getElementById('cancelProperties'),
            deleteInputBtn: document.getElementById('deleteInputBtn'),
            newFieldModal: document.getElementById('newFieldModal'),
            newFieldName: document.getElementById('newFieldName'),
            newFieldType: document.getElementById('newFieldType'),
            newFieldValue: document.getElementById('newFieldValue'),
            createFieldBtn: document.getElementById('createFieldBtn'),
            cancelFieldBtn: document.getElementById('cancelFieldBtn'),
            zoomInBtn: document.getElementById('zoomIn'),
            zoomOutBtn: document.getElementById('zoomOut'),
            fitPageBtn: document.getElementById('zoomFit'),
            zoomLevel: document.getElementById('zoomLevel'),
            pdfContainer: document.querySelector('.pdf-container'),
            clearFieldsBtn: document.getElementById('clearFieldsBtn'),
            exportYamlBtn: document.getElementById('exportYamlBtn')
        };
    }

    setupEventListeners() {
        // Upload PDF - BLOQUEADO HASTA QUE CARGUE YAML
        this.elements.uploadBtn.addEventListener('click', () => {
            this.elements.pdfInput.click();
        });

        // Load YAML
        this.elements.loadYamlBtn.addEventListener('click', () => {
            console.log('📋 Load YAML button clicked');
            this.elements.yamlInput.click();
        });
        
        // Load YAML from instructions
        const loadYamlFromMain = document.getElementById('loadYamlFromMain');
        if (loadYamlFromMain) {
            loadYamlFromMain.addEventListener('click', () => {
                console.log('📋 Load YAML button clicked (from instructions)');
                this.elements.yamlInput.click();
            });
        }

        this.elements.yamlInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadYAML(e.target.files[0]);
            }
        });

        // New PDF button
        this.elements.newPdfBtn.addEventListener('click', () => {
            this.resetEditor();
            this.elements.pdfInput.click();
        });

        this.elements.pdfInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadPDF(e.target.files[0]);
            }
        });

        // Add field mode
        this.elements.addFieldBtn.addEventListener('click', () => {
            console.log('🔧 Add Field Button clicked');
            this.toggleAddFieldMode();
        });

        // Save as PDF
        this.elements.savePdfBtn.addEventListener('click', () => {
            this.savePdfWithFields();
        });

        // Export YAML
        if (this.elements.exportYamlBtn) {
            this.elements.exportYamlBtn.addEventListener('click', () => {
                console.log('📊 Export YAML button clicked');
                this.saveInputsAsYAML();
            });
        }

        // Clear fields button
        if (this.elements.clearFieldsBtn) {
            this.elements.clearFieldsBtn.addEventListener('click', () => {
                this.showClearFieldsDialog();
            });
        }

        // Navigation
        this.elements.prevPage.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderPage();
            }
        });

        this.elements.nextPage.addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.renderPage();
            }
        });

        // Context menu
        document.addEventListener('click', (e) => {
            this.hideContextMenu();
            if (!e.target.closest('#propertiesPanel')) {
                this.hidePropertiesPanel();
            }
        });

        if (this.elements.contextMenu) {
            console.log('✅ Context menu element found, setting up event listener');
            this.elements.contextMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('🖱️ Context menu clicked:', e.target);
                console.log('📋 Action:', e.target.dataset.action);
                console.log('🎯 Selected input:', this.selectedInput);
                
                const action = e.target.dataset.action;
                if (action && this.selectedInput) {
                    console.log('🔥 Executing action:', action);
                    this.handleContextAction(action);
                } else {
                    console.warn('⚠️ Missing action or selected input:', { action, selectedInput: this.selectedInput });
                }
            });
        } else {
            console.error('❌ Context menu element not found!');
        }

        // Properties panel
        this.elements.applyProperties.addEventListener('click', () => {
            this.applyInputProperties();
        });

        this.elements.cancelProperties.addEventListener('click', () => {
            this.hidePropertiesPanel();
        });

        // Delete input button
        if (this.elements.deleteInputBtn) {
            this.elements.deleteInputBtn.addEventListener('click', () => {
                if (this.selectedInput) {
                    this.deleteInput(this.selectedInput);
                    this.hidePropertiesPanel();
                }
            });
        }

        // Zoom controls - con verificación de existencia
        if (this.elements.zoomInBtn) {
            this.elements.zoomInBtn.addEventListener('click', () => {
                this.zoomIn();
            });
        }

        if (this.elements.zoomOutBtn) {
            this.elements.zoomOutBtn.addEventListener('click', () => {
                this.zoomOut();
            });
        }

        if (this.elements.fitPageBtn) {
            this.elements.fitPageBtn.addEventListener('click', () => {
                this.fitToPage();
            });
        }

        // Mouse wheel zoom - enfoque más directo
        this.setupZoomEvents();

        // Touch zoom support para dispositivos móviles (con verificación de existencia)
        if (this.elements.pdfContainer) {
            let touchStartDistance = 0;
            let touchStartZoom = 0;

            this.elements.pdfContainer.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    touchStartDistance = Math.sqrt(
                        Math.pow(touch2.clientX - touch1.clientX, 2) +
                        Math.pow(touch2.clientY - touch1.clientY, 2)
                    );
                    touchStartZoom = this.zoomLevel;
                }
            });

            this.elements.pdfContainer.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    const currentDistance = Math.sqrt(
                        Math.pow(touch2.clientX - touch1.clientX, 2) +
                        Math.pow(touch2.clientY - touch1.clientY, 2)
                    );
                    
                    const scale = currentDistance / touchStartDistance;
                    const newZoom = touchStartZoom * scale;
                    
                    if (newZoom >= this.minZoom && newZoom <= this.maxZoom) {
                        this.zoomLevel = Math.round(newZoom / 25) * 25; // Snap to 25% increments
                        this.updateZoom();
                    }
                }
            });
        }

        // New field modal
        this.elements.createFieldBtn.addEventListener('click', () => {
            console.log('🔧 Create Field Button clicked');
            this.createNewFieldFromModal();
        });

        this.elements.cancelFieldBtn.addEventListener('click', () => {
            console.log('🔧 Cancel Field Button clicked');
            this.hideNewFieldModal();
        });

        // Keyboard zoom shortcuts - mejorados
        this.setupKeyboardZoom();

        // Close modal when clicking outside
        this.elements.newFieldModal.addEventListener('click', (e) => {
            if (e.target === this.elements.newFieldModal) {
                this.hideNewFieldModal();
            }
        });

        // Handle Enter key in modal inputs
        [this.elements.newFieldName, this.elements.newFieldValue].forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.createNewFieldFromModal();
                }
            });
        });

        // Update value field placeholder when type changes
        this.elements.newFieldType.addEventListener('change', (e) => {
            this.updateValueFieldForType(e.target.value);
        });

        // Global drag handlers
        document.addEventListener('mousemove', (e) => {
            if (this.dragData) {
                this.handleDrag(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.dragData) {
                this.endDrag();
            }
        });
    }

    async loadYAML(file) {
        try {
            console.log('📋 Cargando YAML:', file.name);
            const yamlContent = await file.text();
            
            // Parsear YAML usando js-yaml
            this.loadedYaml = jsyaml.load(yamlContent);
            
            console.log('✅ YAML cargado exitosamente');
            console.log('📊 Campos en YAML:', this.loadedYaml.fields?.length || 0);
            
            // Mostrar indicador de YAML cargado
            if (this.elements.yamlStatus) {
                this.elements.yamlStatus.style.display = 'inline';
                this.elements.yamlStatus.textContent = `📋 YAML Cargado (${this.loadedYaml.fields?.length || 0} campos)`;
            }
            
            // ACTUALIZAR INSTRUCCIONES
            this.updateInstructions();
            
            // HABILITAR botón de PDF
            this.elements.uploadBtn.disabled = false;
            
            // Actualizar estado del paso 1
            const step1Status = document.getElementById('step1-status');
            if (step1Status) {
                step1Status.textContent = `✅ YAML Cargado (${this.loadedYaml.fields?.length || 0} campos)`;
                step1Status.style.color = '#00ff00';
            }
            
            // Actualizar estado del paso 2
            const step2Status = document.getElementById('step2-status');
            if (step2Status) {
                step2Status.textContent = `🔓 Ahora puedes cargar el PDF`;
                step2Status.style.color = '#40ff23';
            }
            
            // Marcar paso 1 como activo
            const step1 = document.getElementById('step1');
            if (step1) {
                step1.classList.add('active');
            }
            
            const step2 = document.getElementById('step2');
            if (step2) {
                step2.style.opacity = '1';
            }
            
            alert(`✅ YAML cargado correctamente\n\n📊 Contiene ${this.loadedYaml.fields?.length || 0} campos\n\n💡 Ahora carga el PDF para sincronizar`);
            
        } catch (error) {
            console.error('Error cargando YAML:', error);
            alert('❌ Error al cargar el YAML. Asegúrate de que sea un archivo YAML válido.');
        }
    }

    async loadPDF(file) {
        try {
            // Validar que YAML esté cargado
            if (!this.loadedYaml) {
                alert('❌ Debes cargar el YAML primero\n\nPor favor:\n1. Haz clic en "Cargar YAML"\n2. Selecciona tu archivo YAML\n3. Luego carga el PDF');
                return;
            }
            
            this.showLoading();
            
            const arrayBuffer = await file.arrayBuffer();
            
            // Crear una copia independiente del ArrayBuffer para evitar detachment
            const uint8Array = new Uint8Array(arrayBuffer);
            const pdfBytesCopy = new Uint8Array(uint8Array.length);
            pdfBytesCopy.set(uint8Array);
            
            // Validar que el archivo sea un PDF válido
            const header = new TextDecoder().decode(pdfBytesCopy.slice(0, 8));
            if (!header.startsWith('%PDF-')) {
                throw new Error('El archivo no es un PDF válido o está corrupto');
            }
            
            this.originalPdfBytes = pdfBytesCopy; // Guardar copia independiente
            this.pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            this.totalPages = this.pdf.numPages;
            this.currentPage = 1;

            // Update UI
            this.elements.fileName.textContent = file.name;
            this.elements.pageCount.textContent = this.totalPages;
            this.elements.navigation.style.display = 'flex'; // Siempre mostrar navegación para el botón de descarga
            
            // Hide upload button, show new PDF button, and enable other buttons
            this.elements.uploadBtn.style.display = 'none';
            this.elements.newPdfBtn.style.display = 'inline-flex';
            this.elements.addFieldBtn.disabled = false;
            this.elements.savePdfBtn.disabled = false;

            // Enable export buttons
            if (this.elements.exportYamlBtn) {
                this.elements.exportYamlBtn.disabled = false;
            }

            // Clear previous inputs
            this.clearAllInputs();

            // Extract existing form fields from PDF
            await this.extractExistingFields();
            
            // Si hay YAML cargado, sincronizar con él
            if (this.loadedYaml && this.loadedYaml.fields) {
                console.log('🔄 Sincronizando con YAML cargado...');
                this.syncFieldsWithYAML();
            }

            // Render first page
            await this.renderPage();

            // Initialize zoom display
            this.updateZoomDisplay();
            console.log('PDF loaded successfully, zoom initialized at', this.zoomLevel + '%');
            
            // ACTUALIZAR INSTRUCCIONES - Marcar paso 2 como completado
            const step2 = document.getElementById('step2');
            if (step2) {
                step2.classList.add('active');
            }
            
            const step2Status = document.getElementById('step2-status');
            if (step2Status) {
                step2Status.textContent = `✅ PDF Sincronizado`;
                step2Status.style.color = '#00ff00';
            }
            
            const step3 = document.getElementById('step3');
            if (step3) {
                step3.style.opacity = '1';
            }
            
            const step3Status = document.getElementById('step3-status');
            if (step3Status) {
                step3Status.textContent = `🔓 Puedes editar y exportar`;
                step3Status.style.color = '#40ff23';
            }

        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Error al cargar el PDF. Asegúrate de que sea un archivo PDF válido.');
        }
    }

    showLoading(message = 'Cargando PDF...') {
        this.elements.pdfViewer.innerHTML = `<div class="loading">${message}</div>`;
    }

    showProgress(message) {
        // Mostrar progreso en la consola
        console.log('🔄 ' + message);
        
        // Actualizar el título del botón temporalmente
        const btn = this.elements.savePdfBtn;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ ' + message + '...';
        btn.disabled = true;
        
        // Restaurar después de un momento
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 1000);
    }

    async extractExistingFields() {
        try {
            console.log('Extrayendo campos del PDF...');
            let totalFieldsFound = 0;
            let widgetsWithoutFieldType = 0;
            let widgetsProcessed = 0;
            
            // Extraer campos de todas las páginas
            for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
                const page = await this.pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: this.scale });
                const annotations = await page.getAnnotations();
                
                console.log(`Página ${pageNum}: ${annotations.length} anotaciones encontradas`);
                
                annotations.forEach((annotation, index) => {
                    console.log('📋 Anotación encontrada:', {
                        subtype: annotation.subtype,
                        fieldType: annotation.fieldType,
                        fieldName: annotation.fieldName,
                        alternativeText: annotation.alternativeText,
                        checkBox: annotation.checkBox,
                        radioButton: annotation.radioButton,
                        fieldValue: annotation.fieldValue,
                        flags: annotation.flags
                    });
                    
                    // FILTRO: Procesar anotaciones Widget (campos de formulario)
                    // Algunos widgets puede que no tengan fieldType explícito pero siguen siendo campos válidos
                    if (annotation.subtype !== 'Widget') {
                        console.log('⏭️ Anotación ignorada (no es Widget):', annotation.fieldName || annotation.subtype);
                        return;
                    }
                    
                    // Procesar el Widget
                    if (annotation.subtype === 'Widget') {
                        
                        // Logging para widgets sin fieldType
                        if (!annotation.fieldType) {
                            widgetsWithoutFieldType++;
                            console.log(`⚠️ Widget sin fieldType explícito (${widgetsWithoutFieldType}): ${annotation.fieldName || 'sin nombre'}`);
                        }
                        
                        widgetsProcessed++;
                        
                        // Calcular posición y tamaño
                        const rect = annotation.rect;
                        if (!rect || rect.length < 4) {
                            console.warn('⚠️ Anotación sin rectángulo válido:', annotation);
                            return;
                        }
                        
                        // Convertir coordenadas del PDF a coordenadas del canvas
                        // PDF usa coordenadas desde abajo-izquierda, HTML desde arriba-izquierda
                        const x = rect[0] * this.scale;
                        const y = viewport.height - (rect[3] * this.scale);
                        const width = (rect[2] - rect[0]) * this.scale;
                        const height = (rect[3] - rect[1]) * this.scale;
                        
                        // Determinar tipo de campo - LÓGICA MEJORADA PARA CHECKBOXES
                        let fieldType = 'text';
                        
                        if (annotation.fieldType === 'Tx') {
                            fieldType = annotation.multiLine ? 'textarea' : 'text';
                        } else if (annotation.fieldType === 'Ch') {
                            fieldType = 'text'; // Combobox/Listbox como text por ahora
                        } else if (annotation.fieldType === 'Btn') {
                            // DETECCIÓN MEJORADA DE CHECKBOXES
                            // Verificar múltiples indicadores de checkbox
                            const isCheckbox = annotation.checkBox === true || 
                                             annotation.radioButton === true ||
                                             (annotation.flags && (annotation.flags & 65536)) || // Flag de checkbox
                                             (width <= 30 && height <= 30) || // Tamaño típico de checkbox
                                             (annotation.fieldName && annotation.fieldName.toLowerCase().includes('check')) ||
                                             (annotation.alternativeText && annotation.alternativeText.toLowerCase().includes('check'));
                            
                            if (isCheckbox) {
                                fieldType = 'checkbox';
                                console.log('✅ Checkbox detectado:', annotation.fieldName || annotation.alternativeText);
                            } else {
                                fieldType = 'text'; // Push button como text por ahora
                            }
                        } else {
                            // Si no tiene fieldType pero es un Widget, intentar detectar por otras características
                            if (annotation.subtype === 'Widget') {
                                // Detectar checkbox por tamaño y características
                                if ((width <= 30 && height <= 30) || 
                                    (annotation.fieldName && annotation.fieldName.toLowerCase().includes('check'))) {
                                    fieldType = 'checkbox';
                                    console.log('✅ Checkbox detectado por características:', annotation.fieldName || annotation.alternativeText);
                                }
                            }
                        }
                        
                        // Obtener valor del campo
                        let fieldValue = '';
                        if (fieldType === 'checkbox') {
                            // DETECCIÓN MEJORADA DEL ESTADO DE CHECKBOXES
                            fieldValue = (annotation.fieldValue === 'Yes' || 
                                        annotation.fieldValue === 'On' || 
                                        annotation.fieldValue === 'true' ||
                                        annotation.fieldValue === '1' ||
                                        annotation.fieldValue === true ||
                                        annotation.checkBox === true ||
                                        annotation.radioButton === true) ? 'true' : 'false';
                        } else {
                            if (annotation.fieldValue) {
                                fieldValue = annotation.fieldValue;
                            } else if (annotation.buttonValue) {
                                fieldValue = annotation.buttonValue;
                            } else if (annotation.alternativeText) {
                                fieldValue = annotation.alternativeText;
                            }
                        }
                        
                        // Ajustar dimensiones para checkboxes
                        let finalWidth = Math.max(20, width);
                        let finalHeight = Math.max(20, height);
                        
                        if (fieldType === 'checkbox') {
                            // Para checkboxes, usar un tamaño estándar
                            finalWidth = Math.min(Math.max(15, width), 25);
                            finalHeight = Math.min(Math.max(15, height), 25);
                        }
                        
                        const inputData = {
                            id: `existing_${pageNum}_${index}`,
                            name: annotation.fieldName || annotation.alternativeText || `campo_existente_${this.inputCounter}`,
                            type: fieldType,
                            page: pageNum,
                            x: Math.max(0, x),
                            y: Math.max(0, y),
                            width: finalWidth,
                            height: finalHeight,
                            value: fieldValue,
                            isExisting: true,
                            readonly: annotation.readOnly || false,
                            // Propiedades para sincronización con YAML
                            idpdf: annotation.fieldName || `field_${pageNum}_${index}`,
                            idlogic: '', // Se llenará desde YAML si está disponible
                            optionInfo: null, // Se llenará desde YAML si hay option_info
                            originalAnnotation: {
                                fieldType: annotation.fieldType,
                                subtype: annotation.subtype,
                                flags: annotation.flags,
                                checkBox: annotation.checkBox,
                                radioButton: annotation.radioButton
                            }
                        };
                        
                        this.inputs.push(inputData);
                        console.log(`➕ Campo agregado: ${fieldType} "${inputData.name}" en página ${pageNum}`, inputData);
                    } else {
                        console.log('⏭️ Anotación omitida (no es campo de formulario):', annotation.subtype);
                    }
                });
            }
            
            console.log(`Extracción completada: ${totalFieldsFound} campos encontrados en total`);
            console.log(`  - Widgets procesados: ${widgetsProcessed}`);
            console.log(`  - Widgets sin fieldType explícito: ${widgetsWithoutFieldType}`);
            
            if (totalFieldsFound === 0) {
                console.log('No se encontraron campos de formulario en el PDF');
            }
            
            // NO HACER DEDUPLICACIÓN AQUÍ
            // Los campos duplicados verdaderos se manejarán durante la sincronización con YAML
            console.log(`📊 Campos extraídos del PDF: ${this.inputs.length}`);
            
        } catch (error) {
            console.error('Error extrayendo campos del PDF:', error);
            // Mostrar mensaje al usuario pero continuar
            setTimeout(() => {
                alert('No se pudieron detectar automáticamente los campos existentes del PDF. Puedes agregar campos manualmente.');
            }, 1000);
        }
    }

    syncFieldsWithYAML() {
        console.log('🔄 INICIANDO SINCRONIZACIÓN CON YAML');
        console.log(`   Campos detectados en PDF: ${this.inputs.length}`);
        console.log(`   Campos en YAML: ${this.loadedYaml.fields.length}`);
        
        // Crear un mapa de campos YAML por nombre y página (búsqueda exacta)
        const yamlFieldMap = new Map();
        const yamlFieldMapFuzzy = new Map(); // Búsqueda fuzzy por nombre
        
        this.loadedYaml.fields.forEach(yamlField => {
            const key = `${yamlField.field_name}_${yamlField.page}`;
            yamlFieldMap.set(key, yamlField);
            
            // También guardar solo por nombre (sin página) para búsqueda fuzzy
            yamlFieldMapFuzzy.set(yamlField.field_name, yamlField);
        });
        
        // Sincronizar campos del PDF con info del YAML
        this.inputs.forEach(pdfField => {
            let yamlField = null;
            
            // Búsqueda 1: Exacta por nombre + página
            const keyExact = `${pdfField.name}_${pdfField.page}`;
            yamlField = yamlFieldMap.get(keyExact);
            
            // Búsqueda 2: Si no encontró, buscar solo por nombre (puede estar en página diferente)
            if (!yamlField) {
                yamlField = yamlFieldMapFuzzy.get(pdfField.name);
            }
            
            // Búsqueda 3: Búsqueda parcial si el nombre es muy similar
            if (!yamlField) {
                for (let [key, field] of yamlFieldMap.entries()) {
                    // Verificar si el nombre contiene palabras clave similares
                    if (this.stringSimilarity(pdfField.name, field.field_name) > 0.7) {
                        yamlField = field;
                        console.log(`   ✓ Coincidencia fuzzy encontrada: "${pdfField.name}" → "${field.field_name}"`);
                        break;
                    }
                }
            }
            
            if (yamlField) {
                console.log(`✅ Campo sincronizado: ${pdfField.name}`);
                console.log(`   Lógica: ${yamlField.idlogic ? yamlField.idlogic.substring(0, 50) + '...' : '(vacío)'}`);
                
                // Conservar toda la información del YAML
                pdfField.idlogic = yamlField.idlogic || '';
                pdfField.idpdf = yamlField.idpdf || pdfField.id;
                pdfField.optionInfo = yamlField.option_info || null;
                
                // GUARDAR COORDENADAS ORIGINALES DEL YAML (NO escaladas)
                pdfField.x_coord = yamlField.x_coord;
                pdfField.y_coord = yamlField.y_coord;
                pdfField.width_original = yamlField.width;
                pdfField.height_original = yamlField.height;
                
                // MARCAR que este campo viene del YAML (puede tener duplicados intencionales)
                pdfField.fromYaml = true;
                
                // Conservar el tipo del YAML si es diferente
                if (yamlField.field_type && yamlField.field_type !== 'unknown') {
                    pdfField.type = yamlField.field_type;
                }
            } else {
                console.log(`⚠️ Campo NO encontrado en YAML: ${pdfField.name}`);
                pdfField.idlogic = ''; // Mantener vacío si no está en YAML
                pdfField.fromYaml = false; // Este es un campo nuevo/no sincronizado
            }
        });
        
        console.log('✅ Sincronización completada');
    }
    
    // Función auxiliar para medir similitud entre strings
    stringSimilarity(str1, str2) {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        // Si son iguales, retornar 1
        if (s1 === s2) return 1;
        
        // Si uno contiene al otro, retornar 0.8
        if (s1.includes(s2) || s2.includes(s1)) return 0.8;
        
        // Contar palabras en común
        const words1 = s1.split(/\s+/);
        const words2 = s2.split(/\s+/);
        const commonWords = words1.filter(w => words2.includes(w)).length;
        const totalWords = Math.max(words1.length, words2.length);
        
        return totalWords > 0 ? commonWords / totalWords : 0;
    }

    // Función para generar nombre de archivo modificado
    getModifiedFileName(extension) {
        const fileName = this.elements.fileName.textContent;
        // Remover extensión original
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        return `${nameWithoutExt}_modified.${extension}`;
    }

    // Actualizar instrucciones según el estado
    updateInstructions() {
        // Este método se llama cuando cargamos YAML o PDF
        // para actualizar visualmente el estado del flujo
    }

    async renderPage() {
        try {
            const page = await this.pdf.getPage(this.currentPage);
            const viewport = page.getViewport({ scale: this.scale });

            // Create or update canvas
            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
                this.canvas.id = 'pdfCanvas';
                this.context = this.canvas.getContext('2d');
                
                // Add click handler for adding fields
                this.canvas.addEventListener('click', (e) => {
                    if (this.isAddingField) {
                        this.addInputAtPosition(e);
                    }
                });
            }

            this.canvas.width = viewport.width;
            this.canvas.height = viewport.height;
            this.canvas.style.width = viewport.width + 'px';
            this.canvas.style.height = viewport.height + 'px';
            this.canvas.style.display = 'block';

            // Clear viewer and add canvas
            this.elements.pdfViewer.innerHTML = '';
            this.elements.pdfViewer.appendChild(this.canvas);
            
            // Añadir clases y configurar tamaño para PDF cargado
            this.elements.pdfViewer.classList.add('has-pdf');
            document.querySelector('.pdf-wrapper').classList.add('has-content');
            this.elements.pdfViewer.style.minHeight = viewport.height + 'px';
            this.elements.pdfViewer.style.width = 'auto';
            this.elements.pdfViewer.style.maxWidth = 'none';

            // Render PDF page
            await page.render({
                canvasContext: this.context,
                viewport: viewport
            }).promise;

            // Update page info
            this.elements.pageNum.textContent = this.currentPage;
            this.elements.pageInfo.textContent = `Página ${this.currentPage} de ${this.totalPages}`;

            // Update navigation buttons
            this.elements.prevPage.disabled = this.currentPage === 1;
            this.elements.nextPage.disabled = this.currentPage === this.totalPages;

            // Update zoom level display
            this.elements.zoomLevel.textContent = `${this.zoomLevel}%`;

            // Update fields info
            this.updateFieldsInfo();

            // Re-render inputs for current page
            this.renderInputsForCurrentPage();

        } catch (error) {
            console.error('Error rendering page:', error);
        }
    }

    toggleAddFieldMode() {
        this.isAddingField = !this.isAddingField;
        
        if (this.isAddingField) {
            this.elements.addFieldBtn.textContent = 'Cancelar';
            this.elements.addFieldBtn.classList.add('active');
            this.canvas.classList.add('adding-field');
        } else {
            this.elements.addFieldBtn.textContent = 'Añadir Input';
            this.elements.addFieldBtn.classList.remove('active');
            this.canvas.classList.remove('adding-field');
        }
    }

    addInputAtPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Guardar la posición para crear el campo después
        this.pendingFieldPosition = { x, y };
        
        // Mostrar modal para configurar el campo
        this.showNewFieldModal();
        
        // Exit add mode
        this.toggleAddFieldMode();
    }

    createInputElement(inputData) {
        const inputElement = document.createElement(inputData.type === 'textarea' ? 'textarea' : 'input');
        
        if (inputData.type === 'checkbox') {
            inputElement.type = 'checkbox';
        } else if (inputData.type !== 'textarea') {
            inputElement.type = 'text';
        }

        inputElement.id = inputData.id;
        
        // Estilos unificados para todos los campos (existentes y nuevos)
        let className = `pdf-input`;
        if (inputData.type === 'textarea') {
            className += ' pdf-textarea';
        } else if (inputData.type === 'checkbox') {
            className += ' pdf-checkbox';
        }
        // Ya no agregamos 'existing-field' - todos los campos tendrán el mismo estilo
        inputElement.className = className;
        
        if (inputData.type === 'checkbox') {
            inputElement.checked = inputData.value === 'true' || inputData.value === true;
            inputElement.title = inputData.name; // Tooltip con el nombre
        } else {
            inputElement.value = inputData.value;
            inputElement.placeholder = inputData.name;
        }
        
        // Si es un campo de solo lectura
        if (inputData.readonly) {
            inputElement.readOnly = true;
        }
        
        inputElement.style.left = inputData.x + 'px';
        inputElement.style.top = inputData.y + 'px';
        inputElement.style.setProperty('width', inputData.width + 'px', 'important');
        inputElement.style.setProperty('height', inputData.height + 'px', 'important');

        // Add event listeners
        inputElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                this.startDrag(e, inputData);
            }
        });

        inputElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            console.log('🖱️ Right click on input:', inputData.name);
            this.showContextMenu(e, inputData);
        });

        inputElement.addEventListener('input', (e) => {
            if (inputData.type === 'checkbox') {
                inputData.value = e.target.checked ? 'true' : 'false';
            } else {
                inputData.value = e.target.value;
            }
        });

        // Para checkboxes, también manejar el evento change
        if (inputData.type === 'checkbox') {
            inputElement.addEventListener('change', (e) => {
                inputData.value = e.target.checked ? 'true' : 'false';
            });
        }

        // Manejar focus para cambiar color a blanco
        inputElement.addEventListener('focus', (e) => {
            e.target.style.backgroundColor = '#ffffff';
        });

        // Restaurar color original cuando pierde el focus
        inputElement.addEventListener('blur', (e) => {
            if (inputData.type === 'checkbox') {
                if (inputData.isExisting) {
                    e.target.style.backgroundColor = '#e9f7ef';
                } else {
                    e.target.style.backgroundColor = '#e9ecff';
                }
            } else {
                if (inputData.readonly) {
                    e.target.style.backgroundColor = '#f5f6fa';
                } else if (inputData.isExisting) {
                    e.target.style.backgroundColor = '#e9f7ef';
                } else {
                    e.target.style.backgroundColor = '#e9ecff';
                }
            }
        });

        inputElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editInputProperties(inputData);
        });

        this.elements.pdfViewer.appendChild(inputElement);
    }

    startDrag(event, inputData) {
        if (event.target.matches('input:focus, textarea:focus')) {
            return; // Don't drag when editing text
        }

        event.preventDefault();
        this.selectedInput = inputData;
        
        const rect = this.canvas.getBoundingClientRect();
        this.dragData = {
            input: inputData,
            element: event.target,
            offsetX: event.clientX - rect.left - inputData.x,
            offsetY: event.clientY - rect.top - inputData.y
        };

        document.body.style.userSelect = 'none';
    }

    handleDrag(event) {
        if (!this.dragData) return;

        const rect = this.canvas.getBoundingClientRect();
        const newX = event.clientX - rect.left - this.dragData.offsetX;
        const newY = event.clientY - rect.top - this.dragData.offsetY;

        // Constrain to canvas bounds
        const maxX = this.canvas.width - this.dragData.input.width;
        const maxY = this.canvas.height - this.dragData.input.height;

        this.dragData.input.x = Math.max(0, Math.min(newX, maxX));
        this.dragData.input.y = Math.max(0, Math.min(newY, maxY));

        this.dragData.element.style.left = this.dragData.input.x + 'px';
        this.dragData.element.style.top = this.dragData.input.y + 'px';
    }

    endDrag() {
        this.dragData = null;
        document.body.style.userSelect = '';
    }

    showContextMenu(event, inputData) {
        console.log('📋 Showing context menu for input:', inputData);
        this.selectedInput = inputData;
        
        // Personalizar el menú según el tipo de campo
        const fieldType = inputData.isExisting ? 'existente' : 'nuevo';
        const deleteItem = this.elements.contextMenu.querySelector('[data-action="delete"]');
        deleteItem.textContent = `Eliminar campo ${fieldType}`;
        
        this.elements.contextMenu.style.display = 'block';
        this.elements.contextMenu.style.left = event.pageX + 'px';
        this.elements.contextMenu.style.top = event.pageY + 'px';
        
        console.log('📋 Context menu displayed at:', event.pageX, event.pageY);
        console.log('🎯 Selected input stored:', this.selectedInput);
    }

    hideContextMenu() {
        this.elements.contextMenu.style.display = 'none';
    }

    handleContextAction(action) {
        console.log('🎬 handleContextAction called with:', action);
        console.log('🎯 Selected input:', this.selectedInput);
        
        if (!this.selectedInput) {
            console.warn('⚠️ No selected input for action:', action);
            return;
        }

        switch (action) {
            case 'edit':
                console.log('✏️ Executing edit action');
                this.editInputProperties(this.selectedInput);
                break;
            case 'delete':
                console.log('🗑️ Executing delete action');
                this.deleteInput(this.selectedInput);
                break;
            default:
                console.warn('⚠️ Unknown action:', action);
        }

        this.hideContextMenu();
    }

    editInputProperties(inputData) {
        this.selectedInput = inputData;
        
        // Obtener dimensiones actuales del elemento
        const element = document.getElementById(inputData.id);
        if (element) {
            inputData.width = element.offsetWidth;
            inputData.height = element.offsetHeight;
        }
        
        this.elements.inputName.value = inputData.name;
        this.elements.inputValue.value = inputData.value;
        this.elements.inputType.value = inputData.type;
        this.elements.inputWidth.value = Math.round(inputData.width || 120);
        this.elements.inputHeight.value = Math.round(inputData.height || 30);
        
        // Actualizar el título del panel para mostrar el tipo de campo
        const panelTitle = this.elements.propertiesPanel.querySelector('h4');
        const fieldType = inputData.isExisting ? 'existente' : 'nuevo';
        panelTitle.textContent = `Propiedades del Campo ${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}`;
        
        // Cambiar el texto del botón eliminar según el tipo
        if (this.elements.deleteInputBtn) {
            this.elements.deleteInputBtn.textContent = inputData.isExisting ? 'Eliminar Campo Existente' : 'Eliminar Campo Nuevo';
        }
        
        this.elements.propertiesPanel.style.display = 'block';
    }

    hidePropertiesPanel() {
        this.elements.propertiesPanel.style.display = 'none';
        this.selectedInput = null;
    }

    showNewFieldModal() {
        // Limpiar el formulario
        this.elements.newFieldName.value = '';
        this.elements.newFieldType.value = 'text';
        this.elements.newFieldValue.value = '';
        
        // Actualizar placeholder del valor
        this.updateValueFieldForType('text');
        
        // Mostrar modal
        this.elements.newFieldModal.style.display = 'flex';
        
        // Enfocar el input de nombre
        setTimeout(() => {
            this.elements.newFieldName.focus();
        }, 100);
    }

    updateValueFieldForType(fieldType) {
        const valueField = this.elements.newFieldValue;
        
        if (fieldType === 'checkbox') {
            valueField.placeholder = 'true o false (marcado/desmarcado)';
        } else if (fieldType === 'textarea') {
            valueField.placeholder = 'Texto inicial (multilínea)';
        } else {
            valueField.placeholder = 'Valor inicial';
        }
    }

    hideNewFieldModal() {
        this.elements.newFieldModal.style.display = 'none';
        this.pendingFieldPosition = null;
    }

    createNewFieldFromModal() {
        console.log('🔧 createNewFieldFromModal called');
        const fieldName = this.elements.newFieldName.value.trim();
        console.log('Field name:', fieldName);
        console.log('Pending position:', this.pendingFieldPosition);
        
        // Validar que se ingresó un nombre
        if (!fieldName) {
            alert('Por favor ingresa un nombre para el campo');
            this.elements.newFieldName.focus();
            return;
        }

        // Validar que el nombre no esté duplicado en esta página
        const existingField = this.inputs.find(input => input.name === fieldName);
        if (existingField) {
            const useAnyway = confirm(`Ya existe un campo con el nombre "${fieldName}". \n\n¿Deseas crear el campo de todas formas?\n\n- SÍ: Se creará con el nombre "${fieldName}"\n- NO: Podrás cambiar el nombre`);
            
            if (!useAnyway) {
                this.elements.newFieldName.focus();
                return;
            }
        }

        // Crear el campo con los datos del modal
        this.inputCounter++;
        const fieldType = this.elements.newFieldType.value;
        const inputData = {
            id: `input_${this.inputCounter}`,
            name: fieldName,
            type: fieldType,
            page: this.currentPage,
            x: this.pendingFieldPosition.x,
            y: this.pendingFieldPosition.y,
            width: fieldType === 'textarea' ? 200 : fieldType === 'checkbox' ? 20 : 120,
            height: fieldType === 'textarea' ? 80 : fieldType === 'checkbox' ? 20 : 30,
            value: fieldType === 'checkbox' ? (this.elements.newFieldValue.value.toLowerCase() === 'true' ? 'true' : 'false') : this.elements.newFieldValue.value || ''
        };

        this.inputs.push(inputData);
        this.createInputElement(inputData);
        
        // Ocultar modal
        this.hideNewFieldModal();
        
        // Actualizar información de campos
        this.updateFieldsInfo();
        
        console.log(`✅ Campo "${fieldName}" creado exitosamente con el nombre exacto que escribiste`);
    }

    applyInputProperties() {
        if (!this.selectedInput) return;

        const oldType = this.selectedInput.type;
        this.selectedInput.name = this.elements.inputName.value || this.selectedInput.name;
        this.selectedInput.value = this.elements.inputValue.value;
        this.selectedInput.type = this.elements.inputType.value;
        
        // Aplicar nueva anchura si se especificó
        const newWidth = parseInt(this.elements.inputWidth.value);
        if (!isNaN(newWidth) && newWidth > 0) {
            this.selectedInput.width = Math.max(20, Math.min(2000, newWidth));
        }
        
        // Aplicar nueva altura si se especificó
        const newHeight = parseInt(this.elements.inputHeight.value);
        if (!isNaN(newHeight) && newHeight > 0) {
            this.selectedInput.height = Math.max(20, Math.min(500, newHeight));
        }

        // If type changed, recreate element
        if (oldType !== this.selectedInput.type) {
            // Ajustar dimensiones según el nuevo tipo
            if (this.selectedInput.type === 'checkbox') {
                this.selectedInput.width = 20;
                this.selectedInput.height = 20;
                // Convertir valor a formato checkbox
                if (this.selectedInput.value && this.selectedInput.value !== 'false') {
                    this.selectedInput.value = 'true';
                } else {
                    this.selectedInput.value = 'false';
                }
            } else if (this.selectedInput.type === 'textarea') {
                this.selectedInput.width = Math.max(this.selectedInput.width, 200);
                this.selectedInput.height = Math.max(this.selectedInput.height, 80);
            } else if (this.selectedInput.type === 'text') {
                this.selectedInput.width = Math.max(this.selectedInput.width, 120);
                this.selectedInput.height = 30;
            }
            
            this.deleteInputElement(this.selectedInput);
            this.createInputElement(this.selectedInput);
        } else {
            // Just update existing element
            const element = document.getElementById(this.selectedInput.id);
            if (element) {
                if (this.selectedInput.type === 'checkbox') {
                    element.checked = this.selectedInput.value === 'true';
                    element.title = this.selectedInput.name;
                } else {
                    element.value = this.selectedInput.value;
                    element.placeholder = this.selectedInput.name;
                }
                
                // Aplicar nueva anchura
                if (this.selectedInput.width) {
                    element.style.setProperty('width', this.selectedInput.width + 'px', 'important');
                    console.log(`📏 Campo "${this.selectedInput.name}" - anchura cambiada a: ${this.selectedInput.width}px`);
                }
                
                // Aplicar nueva altura
                if (this.selectedInput.height) {
                    element.style.setProperty('height', this.selectedInput.height + 'px', 'important');
                    console.log(`📏 Campo "${this.selectedInput.name}" - altura cambiada a: ${this.selectedInput.height}px`);
                }
            }
        }

        this.hidePropertiesPanel();
    }

    deleteInput(inputData) {
        console.log('🗑️ deleteInput called with:', inputData);
        
        // Mostrar confirmación de eliminación
        const fieldType = inputData.isExisting ? 'existente' : 'nuevo';
        const confirmMessage = `¿Estás seguro de que deseas eliminar el campo "${inputData.name}"?\n\n` +
                              `Tipo: Campo ${fieldType}\n` +
                              `Página: ${inputData.page}\n\n` +
                              `Esta acción no se puede deshacer.`;
        
        console.log('🔔 Showing confirmation dialog');
        if (!confirm(confirmMessage)) {
            console.log('❌ User canceled deletion');
            return; // El usuario canceló la eliminación
        }

        console.log('✅ User confirmed deletion, proceeding...');
        
        // Proceder con la eliminación
        const index = this.inputs.findIndex(input => input.id === inputData.id);
        if (index > -1) {
            console.log(`📋 ANTES DE ELIMINAR: Array tiene ${this.inputs.length} elementos`);
            console.log(`🎯 Eliminando elemento en índice ${index}:`, this.inputs[index]);
            
            this.inputs.splice(index, 1);
            
            console.log(`📋 DESPUÉS DE ELIMINAR: Array tiene ${this.inputs.length} elementos`);
            console.log('📝 Elementos restantes:');
            this.inputs.forEach((input, i) => {
                console.log(`  ${i + 1}. ID: ${input.id}, Nombre: ${input.name}`);
            });
            
            this.deleteInputElement(inputData);
            this.updateFieldsInfo(); // Actualizar contador de campos
            
            // Log de confirmación
            console.log(`🗑️ Campo "${inputData.name}" (${fieldType}) eliminado exitosamente`);
            
            // Mostrar feedback visual temporal
            this.showProgress(`Campo "${inputData.name}" eliminado`);
        } else {
            console.error('Error: No se pudo encontrar el campo para eliminar');
        }
    }

    deleteInputElement(inputData) {
        const element = document.getElementById(inputData.id);
        if (element) {
            element.remove();
        }
    }

    renderInputsForCurrentPage() {
        // Clear existing input elements
        const existingInputs = this.elements.pdfViewer.querySelectorAll('.pdf-input');
        existingInputs.forEach(input => input.remove());

        // Render inputs for current page
        this.inputs
            .filter(input => input.page === this.currentPage)
            .forEach(input => this.createInputElement(input));
    }

    clearAllInputs() {
        this.inputs = [];
        const existingInputs = this.elements.pdfViewer.querySelectorAll('.pdf-input');
        existingInputs.forEach(input => input.remove());
    }

    updateInputPosition(inputData) {
        const element = document.getElementById(inputData.id);
        if (element) {
            const rect = element.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            inputData.x = rect.left - canvasRect.left;
            inputData.y = rect.top - canvasRect.top;
            inputData.width = rect.width;
            inputData.height = rect.height;
        }
    }

    resetEditor() {
        // Reset all properties
        this.pdf = null;
        this.originalPdfBytes = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.isAddingField = false;
        this.selectedInput = null;
        this.dragData = null;
        this.pendingFieldPosition = null;
        this.loadedYaml = null; // Limpiar YAML cargado

        // Clear all inputs
        this.clearAllInputs();

        // Reset UI
        this.elements.fileName.textContent = '';
        this.elements.pageInfo.textContent = '';
        this.elements.fieldsInfo.style.display = 'none';
        this.elements.navigation.style.display = 'none';
        
        // Limpiar indicador YAML
        if (this.elements.yamlStatus) {
            this.elements.yamlStatus.style.display = 'none';
        }
        
        this.elements.uploadBtn.style.display = 'inline-flex';
        this.elements.newPdfBtn.style.display = 'none';
        this.elements.addFieldBtn.disabled = true;
        this.elements.savePdfBtn.disabled = true;
        
        // Bloquear botón de PDF nuevamente
        this.elements.uploadBtn.disabled = true;
        
        // Resetear instrucciones
        const step1 = document.getElementById('step1');
        const step2 = document.getElementById('step2');
        const step3 = document.getElementById('step3');
        
        if (step1) {
            step1.classList.remove('active');
        }
        if (step2) {
            step2.classList.remove('active');
            step2.style.opacity = '0.5';
        }
        if (step3) {
            step3.classList.remove('active');
            step3.style.opacity = '0.5';
        }
        
        const step1Status = document.getElementById('step1-status');
        if (step1Status) {
            step1Status.textContent = '⏳ Esperando...';
            step1Status.style.color = '#a0a0a0';
        }
        
        const step2Status = document.getElementById('step2-status');
        if (step2Status) {
            step2Status.textContent = '🔒 Deshabilitado - Carga YAML primero';
            step2Status.style.color = '#707070';
        }
        
        const step3Status = document.getElementById('step3-status');
        if (step3Status) {
            step3Status.textContent = '🔒 Deshabilitado - Carga PDF primero';
            step3Status.style.color = '#707070';
        }
        
        // Ocultar botón de limpiar campos
        if (this.elements.clearFieldsBtn) {
            this.elements.clearFieldsBtn.style.display = 'none';
            this.elements.clearFieldsBtn.disabled = true;
        }
        
        // Reset add field button
        this.elements.addFieldBtn.textContent = 'Añadir Input';
        this.elements.addFieldBtn.classList.remove('active');
        if (this.canvas) {
            this.canvas.classList.remove('adding-field');
        }

        // Reset viewer to no-pdf state
        this.elements.pdfViewer.classList.remove('has-pdf');
        document.querySelector('.pdf-wrapper').classList.remove('has-content');
        this.elements.pdfViewer.style.minHeight = '';
        this.elements.pdfViewer.style.width = '';
        this.elements.pdfViewer.style.maxWidth = '';
        
        // Show initial message
        this.elements.pdfViewer.innerHTML = `
            <div class="no-pdf">
                <div class="no-pdf-icon">
                    <img src="assets/pdficon.png" height="100px" alt="PDF" onerror="this.style.display='none'; this.parentNode.innerHTML='PDF';">
                </div>
                <h3>Editor de Inputs en PDF</h3>
                <p>Selecciona un archivo PDF para comenzar a editar</p>
            </div>
        `;

        console.log('Editor reiniciado');
    }

    showClearFieldsDialog() {
        const existingFields = this.inputs.filter(input => input.isExisting);
        const newFields = this.inputs.filter(input => !input.isExisting);
        
        let message = '¿Qué campos deseas eliminar?\n\n';
        
        if (existingFields.length > 0) {
            message += `📋 Campos existentes: ${existingFields.length}\n`;
        }
        
        if (newFields.length > 0) {
            message += `✨ Campos nuevos: ${newFields.length}\n`;
        }
        
        message += '\nOpciones:\n';
        message += '• ACEPTAR: Eliminar TODOS los campos\n';
        message += '• CANCELAR: No eliminar nada';
        
        if (confirm(message)) {
            this.clearAllInputs();
            this.updateFieldsInfo();
            console.log('🗑️ Todos los campos han sido eliminados');
            this.showProgress('Todos los campos eliminados');
            
            // Ocultar botón de limpiar campos
            this.elements.clearFieldsBtn.style.display = 'none';
        }
    }

    saveInputsAsJSON() {
        // Update all input positions and values before saving
        this.inputs.forEach(input => {
            const element = document.getElementById(input.id);
            if (element) {
                input.value = element.value;
                input.width = parseInt(element.style.width);
                input.height = parseInt(element.style.height);
            }
        });

        // Separar campos existentes de nuevos
        const existingFields = this.inputs.filter(input => input.isExisting);
        const newFields = this.inputs.filter(input => !input.isExisting);

        const data = {
            timestamp: new Date().toISOString(),
            pdfInfo: {
                fileName: this.elements.fileName.textContent,
                totalPages: this.totalPages,
                scale: this.scale
            },
            summary: {
                totalFields: this.inputs.length,
                existingFields: existingFields.length,
                newFields: newFields.length
            },
            existingFields: existingFields.map(input => ({
                id: input.id,
                name: input.name,
                type: input.type,
                page: input.page,
                x: input.x,
                y: input.y,
                width: input.width,
                height: input.height,
                value: input.value,
                readonly: input.readonly || false,
                isExisting: true
            })),
            newFields: newFields.map(input => ({
                id: input.id,
                name: input.name,
                type: input.type,
                page: input.page,
                x: input.x,
                y: input.y,
                width: input.width,
                height: input.height,
                value: input.value,
                isExisting: false
            })),
            // Todos los campos juntos para compatibilidad
            allFields: this.inputs.map(input => ({
                id: input.id,
                name: input.name,
                type: input.type,
                page: input.page,
                x: input.x,
                y: input.y,
                width: input.width,
                height: input.height,
                value: input.value,
                isExisting: input.isExisting || false,
                readonly: input.readonly || false
            }))
        };

        // Download as JSON
        const blob = new Blob([JSON.stringify(data, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.getModifiedFileName('json');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`Se han guardado ${this.inputs.length} campos:\n- ${existingFields.length} campos originales del PDF\n- ${newFields.length} campos nuevos agregados`);
    }

    saveInputsAsYAML() {
        // Update all input positions and values before saving
        this.inputs.forEach(input => {
            const element = document.getElementById(input.id);
            if (element) {
                input.value = element.value;
                // NO actualizar width/height - mantener los originales
                // input.width = parseInt(element.style.width);
                // input.height = parseInt(element.style.height);
            }
        });

        // Separar campos existentes de nuevos
        const existingFields = this.inputs.filter(input => input.isExisting);
        const newFields = this.inputs.filter(input => !input.isExisting);

        // Construir el YAML
        let yamlContent = 'pdf_info:\n';
        yamlContent += `  filename: ${this.elements.fileName.textContent}\n`;
        
        // Preservar info del YAML original si existe
        if (this.loadedYaml && this.loadedYaml.pdf_info) {
            if (this.loadedYaml.pdf_info.filepath) {
                yamlContent += `  filepath: ${this.loadedYaml.pdf_info.filepath}\n`;
            }
            if (this.loadedYaml.pdf_info.analysis_date) {
                yamlContent += `  analysis_date: '${this.loadedYaml.pdf_info.analysis_date}'\n`;
            }
        }
        
        yamlContent += `  total_pages: ${this.totalPages}\n`;
        yamlContent += `  total_fields: ${this.inputs.length}\n`;
        yamlContent += `  sorting: 'Natural order: by page, then top-to-bottom, left-to-right'\n`;
        yamlContent += 'fields:\n';

        // Agrupar campos por página y ordenar
        const fieldsByPage = {};
        this.inputs.forEach(input => {
            if (!fieldsByPage[input.page]) {
                fieldsByPage[input.page] = [];
            }
            fieldsByPage[input.page].push(input);
        });

        // Ordenar campos dentro de cada página (top-to-bottom, left-to-right)
        // USAR COORDENADAS ORIGINALES DEL YAML para la comparación
        Object.keys(fieldsByPage).sort((a, b) => parseInt(a) - parseInt(b)).forEach(page => {
            fieldsByPage[page].sort((a, b) => {
                // Usar y_coord original si existe
                const aY = a.y_coord || a.y;
                const bY = b.y_coord || b.y;
                const aX = a.x_coord || a.x;
                const bX = b.x_coord || b.x;
                
                // Primero por Y (top-to-bottom)
                if (Math.abs(aY - bY) > 5) {
                    return aY - bY;
                }
                // Si están en la misma línea, por X (left-to-right)
                return aX - bX;
            });
        });

        // Generar campos en YAML preservando EXACTAMENTE los originales
        let fieldIndex = 0;
        
        Object.keys(fieldsByPage).sort((a, b) => parseInt(a) - parseInt(b)).forEach(page => {
            fieldsByPage[page].forEach(input => {
                // EXPORTAR TODOS - SIN DEDUPLICACION
                // La deduplicacion debe ocurrir en extractExistingFields(), no aqui
                
                // PRESERVAR COORDENADAS ORIGINALES DEL YAML
                const x = input.x_coord !== undefined ? input.x_coord : input.x;
                const y = input.y_coord !== undefined ? input.y_coord : input.y;
                const width = input.width_original !== undefined ? input.width_original : input.width;
                const height = input.height_original !== undefined ? input.height_original : input.height;
                
                yamlContent += `  - x_coord: ${x.toFixed(2)}\n`;
                yamlContent += `    y_coord: ${y.toFixed(2)}\n`;
                yamlContent += `    width: ${width.toFixed(2)}\n`;
                yamlContent += `    height: ${height.toFixed(2)}\n`;
                yamlContent += `    page: ${input.page}\n`;
                yamlContent += `    idpdf: ${input.idpdf || input.id}\n`;
                // PRESERVAR LA LÓGICA EXACTA DEL YAML ORIGINAL
                yamlContent += `    idlogic: '${(input.idlogic || '').toString().replace(/'/g, "\\'")}'  \n`;
                yamlContent += `    field_name: ${input.name}\n`;
                yamlContent += `    field_type: ${input.type}\n`;
                
                // Si hay información de opciones (para checkboxes/radios), agregarla
                if (input.optionInfo) {
                    yamlContent += `    option_info:\n`;
                    yamlContent += `      option_number: ${input.optionInfo.option_number}\n`;
                    yamlContent += `      total_options: ${input.optionInfo.total_options}\n`;
                    yamlContent += `      is_multi_option: ${input.optionInfo.is_multi_option}\n`;
                }
                
                fieldIndex++;
            });
        });

        // Download as YAML
        const blob = new Blob([yamlContent], { 
            type: 'application/x-yaml' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.getModifiedFileName('yaml');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('✅ YAML exportado exitosamente!');
        console.log(`📊 Estadísticas:`);
        console.log(`   - Campos existentes: ${existingFields.length}`);
        console.log(`   - Campos nuevos: ${newFields.length}`);
        console.log(`   - Total de campos: ${this.inputs.length}`);
        console.log(`📋 Información preservada del YAML original`);

        alert(`✅ YAML exportado correctamente!\n\n📊 Resumen:\n- Campos existentes: ${existingFields.length}\n- Campos nuevos: ${newFields.length}\n- Total: ${this.inputs.length}\n\n✨ Preservado:\n✓ Tamaños originales\n✓ Coordenadas originales\n✓ Lógica exacta\n✓ Sin duplicados`);
    }

    async savePdfWithFields() {
        try {
            this.showProgress('Iniciando');
            console.log('Iniciando creación de PDF con campos...');
            console.log('🔍 ESTADO DEL ARRAY this.inputs ANTES DEL EXPORT:');
            console.log('📊 Número total de inputs:', this.inputs.length);
            console.log('📝 Lista de inputs:');
            this.inputs.forEach((input, index) => {
                console.log(`  ${index + 1}. ID: ${input.id}, Nombre: ${input.name}, Página: ${input.page}, Tipo: ${input.type}`);
            });
            console.log('🔍 ==========================================');
            
            // Validar que tenemos el PDF original
            if (!this.originalPdfBytes) {
                throw new Error('No se ha cargado ningún PDF original');
            }
            
            this.showProgress('Actualizando campos');
            
            // Update all input values before saving
            this.inputs.forEach(input => {
                const element = document.getElementById(input.id);
                if (element) {
                    input.value = element.value;
                    input.width = parseInt(element.style.width);
                    input.height = parseInt(element.style.height);
                }
            });

            this.showProgress('Validando PDF');
            console.log('Validando PDF original...');
            console.log('Tamaño del PDF:', this.originalPdfBytes.length, 'bytes');
            
            // Crear otra copia para asegurar que no hay problemas de referencia
            const safePdfBytes = new Uint8Array(this.originalPdfBytes);
            console.log('Header del PDF:', new TextDecoder().decode(safePdfBytes.slice(0, 8)));
            
            // Intentar cargar el PDF original con PDF-lib
            let pdfDoc;
            try {
                this.showProgress('Cargando PDF');
                console.log('Intentando cargar PDF con PDF-lib...');
                pdfDoc = await PDFLib.PDFDocument.load(safePdfBytes);
                console.log('✅ PDF cargado exitosamente con PDF-lib');
            } catch (loadError) {
                console.error('❌ Error cargando PDF con PDF-lib:', loadError);
                console.log('🔄 Intentando método alternativo...');
                
                this.showProgress('Creando PDF nuevo');
                // Intentar crear un nuevo PDF desde cero
                return await this.createNewPdfFromScratch();
            }
            
            const form = pdfDoc.getForm();
            
            // 🆕 NUEVO ENFOQUE: Solo procesar campos NUEVOS (no existentes)
            console.log('🆕 PROCESANDO SOLO CAMPOS NUEVOS...');
            const newInputs = this.inputs.filter(input => !input.isExisting);
            console.log(`🔍 Campos nuevos a procesar: ${newInputs.length}`);
            
            if (newInputs.length === 0) {
                console.log('ℹ️ No hay campos nuevos para añadir. Solo actualizando valores existentes...');
                
                // Actualizar solo valores de campos existentes si tienen cambios
                for (const input of this.inputs.filter(input => input.isExisting && input.value)) {
                    try {
                        const field = form.getField(input.name);
                        if (field && field.constructor.name === 'PDFTextField') {
                            field.setText(input.value);
                            console.log(`✅ Campo existente actualizado: ${input.name} = "${input.value}"`);
                        }
                    } catch (fieldError) {
                        console.warn(`⚠️ No se pudo actualizar campo existente ${input.name}:`, fieldError);
                    }
                }
            } else {
                // Get all pages
                const pages = pdfDoc.getPages();
                
                // Solo procesar páginas que tengan campos NUEVOS
                for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
                    const pageNewInputs = newInputs.filter(input => input.page === pageNum);
                    if (pageNewInputs.length === 0) continue;

                    const page = pages[pageNum - 1];
                    const { width: pageWidth, height: pageHeight } = page.getSize();

                    console.log(`📄 Procesando página ${pageNum}: ${pageNewInputs.length} campos nuevos`);

                    for (const input of pageNewInputs) {
                        try {
                            // Convertir coordenadas de canvas a PDF
                            const pdfX = input.x / this.scale;
                            const pdfY = pageHeight - (input.y / this.scale) - (input.height / this.scale);
                            const pdfWidth = input.width / this.scale;
                            const pdfHeight = input.height / this.scale;

                            // Solo crear campos nuevos
                            this.createNewFormField(form, page, input, pdfX, pdfY, pdfWidth, pdfHeight);

                        } catch (error) {
                            console.error(`❌ Error procesando campo nuevo ${input.id}:`, error);
                        }
                    }
                }
                
                // También actualizar valores de campos existentes si tienen cambios
                const existingInputsWithValues = this.inputs.filter(input => input.isExisting && input.value);
                if (existingInputsWithValues.length > 0) {
                    console.log(`🔄 Actualizando valores de ${existingInputsWithValues.length} campos existentes...`);
                    for (const input of existingInputsWithValues) {
                        try {
                            const field = form.getField(input.name);
                            if (field && field.constructor.name === 'PDFTextField') {
                                field.setText(input.value);
                                console.log(`✅ Campo existente actualizado: ${input.name} = "${input.value}"`);
                            }
                        } catch (fieldError) {
                            console.warn(`⚠️ No se pudo actualizar campo existente ${input.name}:`, fieldError);
                        }
                    }
                }
            }

            // Generate PDF bytes
            console.log('Generando PDF final...');
            const pdfBytes = await pdfDoc.save();

            // Download the PDF
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.getModifiedFileName('pdf');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            const existingCount = this.inputs.filter(input => input.isExisting).length;
            const newCount = this.inputs.filter(input => !input.isExisting).length;
            
            console.log('✅ PDF exportado exitosamente!');
            console.log(`📊 Estadísticas:`);
            console.log(`   - Campos nuevos añadidos: ${newCount}`);
            console.log(`   - Campos existentes conservados: ${existingCount}`);
            console.log(`   - Total de campos en el PDF final: ${existingCount + newCount}`);
            
        } catch (error) {
            console.error('Error creando PDF:', error);
            
            let errorMessage = '❌ Error al crear el PDF.\n\n';
            
            if (error.message && error.message.includes('PDF header')) {
                errorMessage += '🔍 El archivo PDF original parece estar dañado o no es válido.\n\n';
                errorMessage += '💡 Soluciones:\n';
                errorMessage += '• Intenta con un PDF diferente\n';
                errorMessage += '• Usa "Exportar JSON" como alternativa\n';
                errorMessage += '• Verifica que el archivo sea un PDF real';
            } else if (error.message && error.message.includes('No PDF header found')) {
                errorMessage += '📄 El archivo no es un PDF válido o está corrupto.\n\n';
                errorMessage += '💡 Verifica que:\n';
                errorMessage += '• El archivo tenga extensión .pdf\n';
                errorMessage += '• No esté dañado o corrupto\n';
                errorMessage += '• Sea un PDF real, no una imagen renombrada';
            } else {
                errorMessage += `🔧 Detalles del error: ${error.message}\n\n`;
                errorMessage += '💡 Puedes usar "Exportar JSON" como alternativa.';
            }
            
            alert(errorMessage);
        }
    }

    createNewFormField(form, page, input, x, y, width, height) {
        try {
            // Usar el nombre original del campo, solo añadir sufijo si hay conflicto
            let fieldName = input.name;
            
            // Verificar si ya existe un campo con este nombre en el formulario
            const existingFields = form.getFields();
            const existingNames = existingFields.map(field => field.getName());
            
            // Solo añadir sufijo si hay duplicados
            if (existingNames.includes(fieldName)) {
                let counter = 1;
                while (existingNames.includes(`${input.name}_${counter}`)) {
                    counter++;
                }
                fieldName = `${input.name}_${counter}`;
                console.log(`⚠️ Campo duplicado detectado. Renombrado de "${input.name}" a "${fieldName}"`);
            }
            
            // Definir colores según si es campo existente o nuevo
            const isExisting = input.isExisting;
            const backgroundColor = isExisting 
                ? PDFLib.rgb(0.914, 0.969, 0.937) // #e9f7ef para campos existentes
                : PDFLib.rgb(0.914, 0.925, 1);    // #e9ecff para campos nuevos
            
            if (input.type === 'checkbox') {
                // Crear campo de checkbox
                const checkBox = form.createCheckBox(fieldName);
                checkBox.addToPage(page, {
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    borderWidth: 0, // Sin borde
                    backgroundColor: backgroundColor,
                });
                
                // Marcar el checkbox si el valor es true
                if (input.value === 'true' || input.value === true) {
                    checkBox.check();
                } else {
                    checkBox.uncheck();
                }
                
            } else if (input.type === 'textarea') {
                // Crear campo de texto multilínea
                const textField = form.createTextField(fieldName);
                textField.addToPage(page, {
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    borderWidth: 0, // Sin borde
                    backgroundColor: backgroundColor,
                });
                
                if (input.value) {
                    textField.setText(input.value);
                }
                textField.setFontSize(10);
                textField.enableMultiline();
                
            } else {
                // Crear campo de texto simple
                const textField = form.createTextField(fieldName);
                textField.addToPage(page, {
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    borderWidth: 0, // Sin borde
                    backgroundColor: backgroundColor,
                });
                
                if (input.value) {
                    textField.setText(input.value);
                }
                textField.setFontSize(10);
            }
            
            console.log(`Nuevo campo creado: ${fieldName} en (${x}, ${y})`);
            
        } catch (error) {
            console.error('Error creando campo:', error);
        }
    }

    async createNewPdfFromScratch() {
        try {
            console.log('Creando PDF nuevo desde cero...');
            
            // Crear un nuevo PDF documento
            const pdfDoc = await PDFLib.PDFDocument.create();
            
            // Obtener dimensiones de las páginas originales
            const pagePromises = [];
            for (let i = 1; i <= this.totalPages; i++) {
                pagePromises.push(this.pdf.getPage(i));
            }
            const originalPages = await Promise.all(pagePromises);
            
            // Crear páginas en el nuevo PDF
            for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
                const originalPage = originalPages[pageNum - 1];
                const viewport = originalPage.getViewport({ scale: 1 });
                
                // Agregar página con las mismas dimensiones
                const page = pdfDoc.addPage([viewport.width, viewport.height]);
                
                // Renderizar el contenido original como imagen
                try {
                    await this.renderPageAsImageToPdf(originalPage, page, pdfDoc);
                } catch (renderError) {
                    console.warn('No se pudo renderizar la página como imagen:', renderError);
                    // Continuar sin imagen de fondo
                }
                
                // Agregar campos para esta página
                const pageInputs = this.inputs.filter(input => input.page === pageNum);
                console.log(`Agregando ${pageInputs.length} campos a la página ${pageNum}`);
                
                const form = pdfDoc.getForm();
                
                for (const input of pageInputs) {
                    try {
                        const pdfX = input.x / this.scale;
                        const pdfY = viewport.height - (input.y / this.scale) - (input.height / this.scale);
                        const pdfWidth = input.width / this.scale;
                        const pdfHeight = input.height / this.scale;
                        
                        this.createNewFormField(form, page, input, pdfX, pdfY, pdfWidth, pdfHeight);
                    } catch (fieldError) {
                        console.error(`Error creando campo ${input.id}:`, fieldError);
                    }
                }
            }
            
            // Generar y descargar el PDF
            console.log('Generando PDF final...');
            const pdfBytes = await pdfDoc.save();
            
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.getModifiedFileName('pdf');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            const existingCount = this.inputs.filter(input => input.isExisting).length;
            const newCount = this.inputs.filter(input => !input.isExisting).length;
            
            alert(`✅ PDF creado exitosamente!\n\n⚠️ Nota: Se creó un nuevo PDF con solo los campos, ya que el original no se pudo procesar.\n\n📊 Campos incluidos:\n- ${existingCount} campos detectados\n- ${newCount} campos nuevos\n- Total: ${this.inputs.length} campos`);
            
        } catch (error) {
            console.error('Error creando PDF desde cero:', error);
            throw error;
        }
    }

    async renderPageAsImageToPdf(originalPage, pdfPage, pdfDoc) {
        try {
            // Crear un canvas temporal para renderizar la página
            const viewport = originalPage.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // Renderizar la página original
            await originalPage.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Convertir canvas a imagen
            return new Promise((resolve) => {
                canvas.toBlob(async (blob) => {
                    try {
                        const arrayBuffer = await blob.arrayBuffer();
                        const image = await pdfDoc.embedPng(new Uint8Array(arrayBuffer));
                        
                        const { width, height } = pdfPage.getSize();
                        pdfPage.drawImage(image, {
                            x: 0,
                            y: 0,
                            width: width,
                            height: height,
                        });
                        
                        resolve();
                    } catch (error) {
                        console.warn('Error embedding image:', error);
                        resolve(); // Continuar sin imagen
                    }
                }, 'image/png');
            });
        } catch (error) {
            console.warn('Error rendering page as image:', error);
            // No es crítico, continuar sin imagen de fondo
        }
    }

    showDiagnostic() {
        let diagnosticInfo = '🔍 DIAGNÓSTICO DEL PDF\n\n';
        
        if (this.originalPdfBytes) {
            diagnosticInfo += `📄 Archivo: ${this.elements.fileName.textContent}\n`;
            diagnosticInfo += `📏 Tamaño: ${this.originalPdfBytes.length} bytes\n`;
            diagnosticInfo += `📖 Páginas: ${this.totalPages}\n`;
            
            try {
                // Crear copia segura para lectura
                const safeCopy = new Uint8Array(this.originalPdfBytes);
                const header = new TextDecoder().decode(safeCopy.slice(0, 10));
                diagnosticInfo += `🔤 Header: "${header}"\n`;
                
                const isValidPdf = header.startsWith('%PDF-');
                diagnosticInfo += `✅ PDF válido: ${isValidPdf ? 'Sí' : 'No'}\n\n`;
            } catch (headerError) {
                diagnosticInfo += `⚠️ Error leyendo header: ${headerError.message}\n`;
                diagnosticInfo += `✅ PDF válido: Desconocido\n\n`;
            }
            diagnosticInfo += `📊 CAMPOS DETECTADOS:\n`;
            const existingFields = this.inputs.filter(input => input.isExisting);
            const newFields = this.inputs.filter(input => !input.isExisting);
            
            diagnosticInfo += `• Campos existentes: ${existingFields.length}\n`;
            diagnosticInfo += `• Campos nuevos: ${newFields.length}\n`;
            diagnosticInfo += `• Total: ${this.inputs.length}\n\n`;
            
            if (existingFields.length > 0) {
                diagnosticInfo += `📋 CAMPOS EXISTENTES:\n`;
                existingFields.forEach((field, index) => {
                    diagnosticInfo += `${index + 1}. ${field.name} (Página ${field.page})\n`;
                });
            }
            
            if (!isValidPdf) {
                diagnosticInfo += `\n⚠️ PROBLEMA DETECTADO:\n`;
                diagnosticInfo += `El archivo no tiene un header PDF válido.\n`;
                diagnosticInfo += `Esto puede significar que:\n`;
                diagnosticInfo += `• El archivo está corrupto\n`;
                diagnosticInfo += `• No es realmente un PDF\n`;
                diagnosticInfo += `• Es una imagen renombrada como .pdf\n\n`;
                diagnosticInfo += `💡 SOLUCIONES:\n`;
                diagnosticInfo += `• Intenta con otro archivo PDF\n`;
                diagnosticInfo += `• Usa "Exportar JSON" en su lugar\n`;
                diagnosticInfo += `• Verifica el archivo original`;
            }
        } else {
            diagnosticInfo += '❌ No hay PDF cargado';
        }
        
        // Mostrar en una ventana de alert con scroll
        const diagnosticWindow = window.open('', '_blank', 'width=600,height=400');
        diagnosticWindow.document.write(`
            <html>
                <head>
                    <title>Diagnóstico PDF</title>
                    <style>
                        body { font-family: monospace; padding: 20px; white-space: pre-wrap; }
                        .header { color: #2c3e50; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">DIAGNÓSTICO DEL PDF</div>
                    <hr>
                    ${diagnosticInfo.replace(/\n/g, '<br>')}
                </body>
            </html>
        `);
    }

    setupZoomEvents() {
        console.log('Setting up zoom events...');
        
        // Manejar eventos de wheel para zoom Y scroll
        document.addEventListener('wheel', (e) => {
            const pdfContainer = document.querySelector('.pdf-container');
            if (!pdfContainer) return;
            
            const rect = pdfContainer.getBoundingClientRect();
            const isOverPdfArea = (
                e.clientX >= rect.left && 
                e.clientX <= rect.right && 
                e.clientY >= rect.top && 
                e.clientY <= rect.bottom
            );

            if (isOverPdfArea) {
                if (e.ctrlKey || e.metaKey) {
                    // ZOOM MODE - Con Ctrl presionado
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`Wheel ZOOM - Ctrl: ${e.ctrlKey}, Delta: ${e.deltaY}`);
                    
                    if (e.deltaY < 0) {
                        console.log('🔍 ZOOM IN aplicado!');
                        this.zoomIn();
                    } else {
                        console.log('🔍 ZOOM OUT aplicado!');
                        this.zoomOut();
                    }
                } else {
                    // SCROLL MODE - Sin Ctrl, permitir scroll natural
                    console.log(`Wheel SCROLL - Delta: ${e.deltaY}`);
                    // No preventDefault aquí, permitir scroll natural
                }
            }
        }, { passive: false });
        
        console.log('Zoom events configured successfully!');
    }

    setupKeyboardZoom() {
        document.addEventListener('keydown', (e) => {
            // Solo funcionar si hay un PDF cargado
            if (!this.pdf) return;
            
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case '=':
                    case '+':
                        e.preventDefault();
                        this.zoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        this.zoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        this.fitToPage();
                        break;
                }
            }
        });
    }

    // Zoom functionality
    zoomIn() {
        if (!this.pdf) return;
        
        if (this.zoomLevel < this.maxZoom) {
            this.zoomLevel += 25;
            this.updateZoom();
            console.log(`Zoom In: ${this.zoomLevel}%`);
        } else {
            console.log(`Zoom máximo alcanzado: ${this.maxZoom}%`);
        }
    }

    zoomOut() {
        if (!this.pdf) return;
        
        if (this.zoomLevel > this.minZoom) {
            this.zoomLevel -= 25;
            this.updateZoom();
            console.log(`Zoom Out: ${this.zoomLevel}%`);
        } else {
            console.log(`Zoom mínimo alcanzado: ${this.minZoom}%`);
        }
    }

    fitToPage() {
        if (!this.pdf) return;
        
        const containerWidth = this.elements.pdfViewer.clientWidth - 48; // padding
        const containerHeight = this.elements.pdfViewer.clientHeight - 48;
        
        this.pdf.getPage(this.currentPage).then(page => {
            const viewport = page.getViewport({ scale: 1.0 });
            
            const scaleX = containerWidth / viewport.width;
            const scaleY = containerHeight / viewport.height;
            const fitScale = Math.min(scaleX, scaleY);
            
            this.zoomLevel = Math.round(fitScale * 100);
            this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel));
            
            this.updateZoom();
        });
    }

    updateZoomDisplay() {
        if (this.elements.zoomLevel) {
            this.elements.zoomLevel.textContent = `${this.zoomLevel}%`;
        }
    }

    updateZoom() {
        // Calcular la nueva escala
        this.scale = (this.zoomLevel / 100) * 1.5; // Base scale of 1.5
        
        // Actualizar el display del zoom con feedback visual
        if (this.elements.zoomLevel) {
            this.elements.zoomLevel.textContent = `${this.zoomLevel}%`;
            this.elements.zoomLevel.classList.add('updating');
            setTimeout(() => {
                this.elements.zoomLevel.classList.remove('updating');
            }, 200);
        }
        
        // Re-renderizar la página con el nuevo zoom
        if (this.pdf && this.currentPage) {
            console.log(`Actualizando zoom a ${this.zoomLevel}% (escala: ${this.scale})`);
            this.renderPage();
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PDFInputEditor();
});