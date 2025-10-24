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

        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
    }

    updateFieldsInfo() {
        const fieldsInfoElement = document.getElementById('fieldsInfo');
        if (this.inputs.length > 0) {
            const existingCount = this.inputs.filter(input => input.isExisting).length;
            const newCount = this.inputs.filter(input => !input.isExisting).length;
            const currentPageFields = this.inputs.filter(input => input.page === this.currentPage).length;
            
            fieldsInfoElement.textContent = `${existingCount} existentes + ${newCount} nuevos (${currentPageFields} en esta página)`;
            fieldsInfoElement.style.display = 'inline';
        } else {
            fieldsInfoElement.style.display = 'none';
        }
    }

    setupElements() {
        // Referencias a elementos DOM
        this.elements = {
            pdfInput: document.getElementById('pdfInput'),
            uploadBtn: document.getElementById('uploadBtn'),
            addFieldBtn: document.getElementById('addFieldBtn'),
            savePdfBtn: document.getElementById('savePdfBtn'),
            newPdfBtn: document.getElementById('newPdfBtn'),
            fileName: document.getElementById('fileName'),
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
            applyProperties: document.getElementById('applyProperties'),
            cancelProperties: document.getElementById('cancelProperties'),
            newFieldModal: document.getElementById('newFieldModal'),
            newFieldName: document.getElementById('newFieldName'),
            newFieldType: document.getElementById('newFieldType'),
            newFieldValue: document.getElementById('newFieldValue'),
            createFieldBtn: document.getElementById('createFieldBtn'),
            cancelFieldBtn: document.getElementById('cancelFieldBtn')
        };
    }

    setupEventListeners() {
        // Upload PDF
        this.elements.uploadBtn.addEventListener('click', () => {
            this.elements.pdfInput.click();
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
            this.toggleAddFieldMode();
        });

        // Save as PDF
        this.elements.savePdfBtn.addEventListener('click', () => {
            this.savePdfWithFields();
        });

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

        this.elements.contextMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = e.target.dataset.action;
            if (action && this.selectedInput) {
                this.handleContextAction(action);
            }
        });

        // Properties panel
        this.elements.applyProperties.addEventListener('click', () => {
            this.applyInputProperties();
        });

        this.elements.cancelProperties.addEventListener('click', () => {
            this.hidePropertiesPanel();
        });

        // New field modal
        this.elements.createFieldBtn.addEventListener('click', () => {
            this.createNewFieldFromModal();
        });

        this.elements.cancelFieldBtn.addEventListener('click', () => {
            this.hideNewFieldModal();
        });

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

    async loadPDF(file) {
        try {
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

            // Clear previous inputs
            this.clearAllInputs();

            // Extract existing form fields from PDF
            await this.extractExistingFields();

            // Render first page
            await this.renderPage();

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
            
            // Extraer campos de todas las páginas
            for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
                const page = await this.pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: this.scale });
                const annotations = await page.getAnnotations();
                
                console.log(`Página ${pageNum}: ${annotations.length} anotaciones encontradas`);
                
                annotations.forEach((annotation, index) => {
                    console.log('Anotación:', annotation);
                    
                    // Procesar campos de formulario (Widget) y campos de texto
                    if ((annotation.subtype === 'Widget' || annotation.fieldType) && 
                        (annotation.fieldName || annotation.alternativeText)) {
                        
                        this.inputCounter++;
                        totalFieldsFound++;
                        
                        // Calcular posición y tamaño
                        const rect = annotation.rect;
                        if (!rect || rect.length < 4) return;
                        
                        // Convertir coordenadas del PDF a coordenadas del canvas
                        // PDF usa coordenadas desde abajo-izquierda, HTML desde arriba-izquierda
                        const x = rect[0] * this.scale;
                        const y = viewport.height - (rect[3] * this.scale);
                        const width = (rect[2] - rect[0]) * this.scale;
                        const height = (rect[3] - rect[1]) * this.scale;
                        
                        // Determinar tipo de campo
                        let fieldType = 'text';
                        if (annotation.fieldType === 'Tx') {
                            fieldType = annotation.multiLine ? 'textarea' : 'text';
                        } else if (annotation.fieldType === 'Ch') {
                            fieldType = 'text'; // Combobox/Listbox como text por ahora
                        } else if (annotation.fieldType === 'Btn') {
                            // Determinar si es checkbox, radio button o push button
                            if (annotation.checkBox || annotation.radioButton) {
                                fieldType = 'checkbox';
                            } else {
                                fieldType = 'text'; // Push button como text por ahora
                            }
                        }
                        
                        // Obtener valor del campo
                        let fieldValue = '';
                        if (fieldType === 'checkbox') {
                            // Para checkboxes, determinar si está marcado
                            fieldValue = (annotation.fieldValue === 'Yes' || 
                                        annotation.fieldValue === 'On' || 
                                        annotation.fieldValue === true ||
                                        annotation.checkBox === true) ? 'true' : 'false';
                        } else {
                            if (annotation.fieldValue) {
                                fieldValue = annotation.fieldValue;
                            } else if (annotation.buttonValue) {
                                fieldValue = annotation.buttonValue;
                            } else if (annotation.alternativeText) {
                                fieldValue = annotation.alternativeText;
                            }
                        }
                        
                        const inputData = {
                            id: `existing_${pageNum}_${index}`,
                            name: annotation.fieldName || annotation.alternativeText || `campo_existente_${this.inputCounter}`,
                            type: fieldType,
                            page: pageNum,
                            x: Math.max(0, x),
                            y: Math.max(0, y),
                            width: Math.max(80, width),
                            height: Math.max(25, height),
                            value: fieldValue,
                            isExisting: true,
                            readonly: annotation.readOnly || false,
                            originalAnnotation: {
                                fieldType: annotation.fieldType,
                                subtype: annotation.subtype,
                                flags: annotation.flags
                            }
                        };
                        
                        this.inputs.push(inputData);
                        console.log('Campo agregado:', inputData);
                    }
                });
            }
            
            console.log(`Extracción completada: ${totalFieldsFound} campos encontrados en total`);
            
            if (totalFieldsFound === 0) {
                console.log('No se encontraron campos de formulario en el PDF');
            }
            
        } catch (error) {
            console.error('Error extrayendo campos del PDF:', error);
            // Mostrar mensaje al usuario pero continuar
            setTimeout(() => {
                alert('No se pudieron detectar automáticamente los campos existentes del PDF. Puedes agregar campos manualmente.');
            }, 1000);
        }
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

            // Clear viewer and add canvas
            this.elements.pdfViewer.innerHTML = '';
            this.elements.pdfViewer.appendChild(this.canvas);

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
        
        // Diferentes estilos para campos existentes vs nuevos
        let className = `pdf-input`;
        if (inputData.type === 'textarea') {
            className += ' pdf-textarea';
        } else if (inputData.type === 'checkbox') {
            className += ' pdf-checkbox';
        }
        if (inputData.isExisting) {
            className += ' existing-field';
        }
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
        inputElement.style.width = inputData.width + 'px';
        inputElement.style.height = inputData.height + 'px';

        // Add event listeners
        inputElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                this.startDrag(e, inputData);
            }
        });

        inputElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
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
        this.selectedInput = inputData;
        this.elements.contextMenu.style.display = 'block';
        this.elements.contextMenu.style.left = event.pageX + 'px';
        this.elements.contextMenu.style.top = event.pageY + 'px';
    }

    hideContextMenu() {
        this.elements.contextMenu.style.display = 'none';
    }

    handleContextAction(action) {
        if (!this.selectedInput) return;

        switch (action) {
            case 'edit':
                this.editInputProperties(this.selectedInput);
                break;
            case 'delete':
                this.deleteInput(this.selectedInput);
                break;
        }

        this.hideContextMenu();
    }

    editInputProperties(inputData) {
        this.selectedInput = inputData;
        
        // Obtener dimensiones actuales del elemento
        const element = document.getElementById(inputData.id);
        if (element) {
            inputData.width = element.offsetWidth;
        }
        
        this.elements.inputName.value = inputData.name;
        this.elements.inputValue.value = inputData.value;
        this.elements.inputType.value = inputData.type;
        this.elements.inputWidth.value = Math.round(inputData.width || 120);
        
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
        const fieldName = this.elements.newFieldName.value.trim();
        
        // Validar que se ingresó un nombre
        if (!fieldName) {
            alert('Por favor ingresa un nombre para el campo');
            this.elements.newFieldName.focus();
            return;
        }

        // Validar que el nombre no esté duplicado
        const existingField = this.inputs.find(input => input.name === fieldName);
        if (existingField) {
            alert(`Ya existe un campo con el nombre "${fieldName}". Por favor elige un nombre diferente.`);
            this.elements.newFieldName.focus();
            return;
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
        
        console.log(`✅ Campo "${fieldName}" creado exitosamente`);
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
                    element.style.width = this.selectedInput.width + 'px';
                    console.log(`📏 Campo "${this.selectedInput.name}" - anchura cambiada a: ${this.selectedInput.width}px`);
                }
            }
        }

        this.hidePropertiesPanel();
    }

    deleteInput(inputData) {
        const index = this.inputs.findIndex(input => input.id === inputData.id);
        if (index > -1) {
            this.inputs.splice(index, 1);
            this.deleteInputElement(inputData);
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

        // Clear all inputs
        this.clearAllInputs();

        // Reset UI
        this.elements.fileName.textContent = '';
        this.elements.pageInfo.textContent = '';
        this.elements.fieldsInfo.style.display = 'none';
        this.elements.navigation.style.display = 'none';
        this.elements.uploadBtn.style.display = 'inline-flex';
        this.elements.newPdfBtn.style.display = 'none';
        this.elements.addFieldBtn.disabled = true;
        this.elements.savePdfBtn.disabled = true;
        
        // Reset add field button
        this.elements.addFieldBtn.textContent = 'Añadir Input';
        this.elements.addFieldBtn.classList.remove('active');
        if (this.canvas) {
            this.canvas.classList.remove('adding-field');
        }

        // Show initial message
        this.elements.pdfViewer.innerHTML = `
            <div class="no-pdf">
                <div class="no-pdf-icon">PDF</div>
                <h3>Editor de Inputs en PDF</h3>
                <p>Selecciona un archivo PDF para comenzar a editar</p>
            </div>
        `;

        console.log('Editor reiniciado');
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
        a.download = `pdf-fields-complete-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`Se han guardado ${this.inputs.length} campos:\n- ${existingFields.length} campos originales del PDF\n- ${newFields.length} campos nuevos agregados`);
    }

    async savePdfWithFields() {
        try {
            this.showProgress('Iniciando');
            console.log('Iniciando creación de PDF con campos...');
            
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
            
            // Get all pages
            const pages = pdfDoc.getPages();
            
            // Procesar campos por página
            for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
                const pageInputs = this.inputs.filter(input => input.page === pageNum);
                if (pageInputs.length === 0) continue;

                const page = pages[pageNum - 1];
                const { width: pageWidth, height: pageHeight } = page.getSize();

                console.log(`Procesando página ${pageNum}: ${pageInputs.length} campos`);

                for (const input of pageInputs) {
                    try {
                        // Convertir coordenadas de canvas a PDF
                        const pdfX = input.x / this.scale;
                        const pdfY = pageHeight - (input.y / this.scale) - (input.height / this.scale);
                        const pdfWidth = input.width / this.scale;
                        const pdfHeight = input.height / this.scale;

                        if (input.isExisting && input.name) {
                            // Intentar actualizar campo existente
                            try {
                                const field = form.getField(input.name);
                                if (field && input.value) {
                                    if (field.constructor.name === 'PDFTextField') {
                                        field.setText(input.value);
                                        console.log(`Campo existente actualizado: ${input.name} = "${input.value}"`);
                                    }
                                }
                            } catch (fieldError) {
                                console.log(`No se pudo actualizar campo existente ${input.name}, creando nuevo:`, fieldError);
                                // Si falla, crear como campo nuevo
                                this.createNewFormField(form, page, input, pdfX, pdfY, pdfWidth, pdfHeight);
                            }
                        } else {
                            // Crear nuevo campo
                            this.createNewFormField(form, page, input, pdfX, pdfY, pdfWidth, pdfHeight);
                        }

                    } catch (error) {
                        console.error(`Error procesando input ${input.id}:`, error);
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
            const fileName = this.elements.fileName.textContent.replace('.pdf', '') || 'documento';
            a.download = `${fileName}_con_campos_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            const existingCount = this.inputs.filter(input => input.isExisting).length;
            const newCount = this.inputs.filter(input => !input.isExisting).length;
            
            alert(`✅ PDF descargado exitosamente!\n\n📊 Campos incluidos:\n- ${existingCount} campos originales\n- ${newCount} campos nuevos\n- Total: ${this.inputs.length} campos`);

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
            const fieldName = input.name + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            
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
            const fileName = this.elements.fileName.textContent.replace('.pdf', '') || 'documento';
            a.download = `${fileName}_campos_${Date.now()}.pdf`;
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PDFInputEditor();
});