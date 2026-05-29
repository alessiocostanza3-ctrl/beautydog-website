/* ==========================================================================
   BeautyDog - Modern Grooming Salon JavaScript Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Current Local Time Context: 2026-05-25
    const CURRENT_YEAR = 2026;
    const CURRENT_MONTH = 4; // May (0-indexed in JS Dates: Jan=0, Feb=1, Mar=2, Apr=3, May=4)
    const CURRENT_DAY = 25;
    const TODAY_DATE = new Date(CURRENT_YEAR, CURRENT_MONTH, CURRENT_DAY);

    // Salon Phone (For WhatsApp Link)
    const SALON_PHONE = typeof CONFIG !== 'undefined' && CONFIG.SALON_PHONE ? CONFIG.SALON_PHONE : "393208821749";

    // Buddy Chatbot Dynamic Configuration
    let buddyApiKey = typeof CONFIG !== 'undefined' ? CONFIG.GEMINI_API_KEY : "";
    let buddySystemPrompt = `Sei Buddy, l'assistente virtuale a quattro zampe di BeautyDog, il salone di toelettatura professionale di Carol D'Andrea a Palma di Montechiaro (AG).
Parla sempre in italiano, con un tono amichevole, caloroso, ed empatico, usando emoji a tema cane (🐶, 🐾, 🐩, ✂️).
Il tuo obiettivo è rispondere alle domande degli utenti in modo naturale ed efficiente. Mantieni le risposte brevi (massimo 3-4 frasi), adatte a una finestrella di chat.

Ecco le informazioni ufficiali del salone che devi conoscere:
1. Titolare: Carol D'Andrea, toelettatrice professionista diplomata A.N.T.
2. Indirizzo: Via IV Novembre, 45, 92020 Palma di Montechiaro (AG).
3. Parcheggio: Ampio parcheggio clienti gratuito direttamente di fronte al salone.
4. Orari: Lun-Ven: 09:00-13:00, 15:00-19:00. Sab: 09:00-13:00. Dom: Chiuso.
5. Contatti: Telefono/WhatsApp +39 320 882 1749. Email info@beautydogpalma.it.
6. Filosofia: "Salone Senza Stress" - un cane alla volta, zero gabbie di attesa.
7. Prodotti: Cosmetici 100% bio, vegani e ipoallergenici con Camomilla, Olio di Neem e Proteine della Seta.
8. Tessera Fedeltà: Raccolta timbri (Fidelity Card) sul sito: ogni 5 trattamenti un omaggio (es. pulizia dentale all'ozono gratuita).
9. Trattamenti e Prezzi indicativi:
   - Bagno & Igiene (da 25€): bagno, spazzolatura, taglio unghie, igiene intima.
   - Taglio & Tosatura (da 40€): taglio a forbice, tosatura a macchinetta o stripping.
   - SPA & Ozonoterapia (da 35€): idromassaggio all'ozono per dermatiti e benessere del pelo.

Se l'utente esprime chiaramente l'intenzione di prenotare un appuntamento o un trattamento, rispondi in modo amichevole e includi la parola chiave "[BOOK]" nella tua risposta.`;

    // -------------------------------------------------------------
    // DB & Integration Service Layer (Firebase + Local Fallback)
    // -------------------------------------------------------------
    const DbService = {
        firebaseActive: false,
        db: null,

        init() {
            const hasFirebaseKeys = typeof firebaseConfig !== 'undefined' && 
                                   firebaseConfig.apiKey && 
                                   !firebaseConfig.apiKey.includes("YOUR_");
            
            if (hasFirebaseKeys) {
                try {
                    const app = firebase.initializeApp(firebaseConfig);
                    this.db = firebase.firestore(app);
                    this.firebaseActive = true;
                    console.log("BeautyDog: Firebase initialized successfully.");
                } catch (error) {
                    console.error("BeautyDog: Error initializing Firebase:", error);
                }
            } else {
                console.log("BeautyDog: Running in Demo Mode (Local Storage).");
            }

            const hasEmailJSKeys = typeof CONFIG !== 'undefined' && 
                                   CONFIG.EMAILJS_PUBLIC_KEY && 
                                   !CONFIG.EMAILJS_PUBLIC_KEY.includes("YOUR_");
            if (hasEmailJSKeys && typeof emailjs !== 'undefined') {
                try {
                    emailjs.init(CONFIG.EMAILJS_PUBLIC_KEY);
                    console.log("BeautyDog: EmailJS initialized.");
                } catch (error) {
                    console.error("BeautyDog: Error initializing EmailJS:", error);
                }
            }

            // Load Buddy settings (Gemini API key and prompt)
            this.loadBuddySettings();
        },

        async loadBuddySettings() {
            // Load local storage fallback first
            const localKey = localStorage.getItem('buddy_gemini_api_key');
            const localPrompt = localStorage.getItem('buddy_system_prompt');
            if (localKey) {
                buddyApiKey = localKey;
            }
            if (localPrompt) {
                buddySystemPrompt = localPrompt;
            }

            // If Firebase is active, query the Firestore database for settings
            if (this.firebaseActive && this.db) {
                try {
                    const doc = await this.db.collection("settings").doc("buddy").get();
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.gemini_api_key) {
                            buddyApiKey = data.gemini_api_key;
                            // Also keep local storage in sync
                            localStorage.setItem('buddy_gemini_api_key', data.gemini_api_key);
                        }
                        if (data.system_prompt) {
                            buddySystemPrompt = data.system_prompt;
                            // Also keep local storage in sync
                            localStorage.setItem('buddy_system_prompt', data.system_prompt);
                        }
                        console.log("BeautyDog: Buddy settings loaded from Firebase Firestore.");
                    }
                } catch (error) {
                    console.error("BeautyDog: Error loading Buddy settings from Firebase:", error);
                }
            }
        },

        async getBookingsForDate(dateString) {
            if (this.firebaseActive && this.db) {
                try {
                    const snapshot = await this.db.collection("bookings")
                        .where("date", "==", dateString)
                        .get();
                    
                    const bookings = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.status !== "cancelled") {
                            bookings.push(data);
                        }
                    });
                    return bookings;
                } catch (error) {
                    console.error("Error fetching bookings from Firebase:", error);
                    return this.getLocalBookings(dateString);
                }
            } else {
                return this.getLocalBookings(dateString);
            }
        },

        getLocalBookings(dateString) {
            const data = localStorage.getItem('beautydog_bookings');
            const allBookings = data ? JSON.parse(data) : [];
            return allBookings.filter(b => b.date === dateString);
        },

        async addBooking(bookingObj) {
            const status = CONFIG.AUTO_APPROVE ? 'confirmed' : 'pending';
            const enrichedBooking = {
                ...bookingObj,
                status: status,
                createdAt: new Date().toISOString()
            };

            if (this.firebaseActive && this.db) {
                try {
                    const docRef = this.db.collection("bookings").doc();
                    enrichedBooking.id = docRef.id;
                    await docRef.set(enrichedBooking);
                    console.log("Booking saved to Firebase:", docRef.id);
                    this.sendEmailNotification(enrichedBooking);
                    return enrichedBooking;
                } catch (error) {
                    console.error("Error saving booking to Firebase:", error);
                    return this.addLocalBooking(enrichedBooking);
                }
            } else {
                return this.addLocalBooking(enrichedBooking);
            }
        },

        addLocalBooking(bookingObj) {
            const data = localStorage.getItem('beautydog_bookings');
            const bookings = data ? JSON.parse(data) : [];
            bookingObj.id = "local_" + Math.random().toString(36).substr(2, 9);
            bookings.push(bookingObj);
            localStorage.setItem('beautydog_bookings', JSON.stringify(bookings));
            console.log("Booking saved to LocalStorage:", bookingObj.id);
            return bookingObj;
        },

        sendEmailNotification(bookingObj) {
            const hasEmailJS = typeof CONFIG !== 'undefined' && 
                               CONFIG.EMAILJS_SERVICE_ID && 
                               !CONFIG.EMAILJS_SERVICE_ID.includes("YOUR_");
            
            if (hasEmailJS && typeof emailjs !== 'undefined') {
                const emailParams = {
                    owner_email: CONFIG.OWNER_EMAIL,
                    client_name: bookingObj.clientName,
                    client_phone: bookingObj.clientPhone,
                    client_zone: bookingObj.clientZone || 'Non specificata',
                    pet_name: bookingObj.petName,
                    pet_breed: bookingObj.petBreed,
                    pet_age: bookingObj.petAge || 'Non specificata',
                    service: bookingObj.service,
                    size: bookingObj.size,
                    price: bookingObj.price,
                    date: bookingObj.date,
                    time: bookingObj.time,
                    notes: bookingObj.notes || 'Nessuna nota',
                    status: bookingObj.status
                };

                emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_ID, emailParams)
                    .then(response => {
                        console.log("Email notification sent successfully:", response.status, response.text);
                    })
                    .catch(error => {
                        console.error("Failed to send email notification:", error);
                    });
            }
        }
    };

    DbService.init();

    // -------------------------------------------------------------
    // Mock Bookings Initialization (Enhanced for Analytics Test)
    // -------------------------------------------------------------
    function initMockBookings() {
        if (DbService.firebaseActive) return;
        if (!localStorage.getItem('beautydog_bookings')) {
            const mockBookings = [];
            const zones = ["Palma Centro", "Villaggio Giordano", "Marina di Palma", "Licata", "Campobello", "Altro"];
            const breeds = ["Barboncino", "Pastore Tedesco", "Chihuahua", "Meticcio", "Labrador", "Maltese", "Cocker", "Volpino"];
            const names = ["Mario Rossi", "Giulia Bianchi", "Luca Verdi", "Alessio Costanza", "Salvatore Greco", "Francesca Bruno", "Giuseppe Rizzo", "Anna Esposito"];
            const services = ["Bagno & Igiene", "Taglio & Tosatura", "SPA & Ozonoterapia"];
            const sizes = ["Piccola (Fino a 10kg)", "Media (10-25kg)", "Grande (Oltre 25kg)"];
            const statusOptions = ["confirmed", "confirmed", "confirmed", "pending", "cancelled"];

            // Generate mock bookings for the last 5 days and next 10 days to show rich trends
            for (let i = -5; i < 10; i++) {
                const date = new Date(CURRENT_YEAR, CURRENT_MONTH, CURRENT_DAY + i);
                const dateString = formatDateString(date);
                
                // Don't book on Sundays
                if (date.getDay() === 0) continue;

                // Pick 1-4 random slots to be busy
                const potentialSlots = ["09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00"];
                const shuffled = potentialSlots.sort(() => 0.5 - Math.random());
                const busyCount = Math.floor(Math.random() * 4) + 1;
                
                for (let j = 0; j < busyCount; j++) {
                    const breed = breeds[Math.floor(Math.random() * breeds.length)];
                    const zone = zones[Math.floor(Math.random() * zones.length)];
                    const client = names[Math.floor(Math.random() * names.length)];
                    const service = services[Math.floor(Math.random() * services.length)];
                    const size = sizes[Math.floor(Math.random() * sizes.length)];
                    const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
                    
                    let price = 15;
                    if (service.includes("Taglio")) price = 25;
                    if (service.includes("SPA")) price = 35;
                    if (size.includes("Media")) price += 5;
                    if (size.includes("Grande")) price += 15;

                    mockBookings.push({
                        id: "mock_" + Math.random().toString(36).substr(2, 9),
                        date: dateString,
                        time: shuffled[j],
                        service: service,
                        size: size,
                        petName: "Leo",
                        petBreed: breed,
                        petAge: String(Math.floor(Math.random() * 12) + 1),
                        clientName: client,
                        clientPhone: "39320" + Math.floor(1000000 + Math.random() * 9000000),
                        clientZone: zone,
                        price: price,
                        status: status,
                        notes: "Simulazione appuntamento toelettatura.",
                        createdAt: new Date(date.getTime() - 86400000).toISOString()
                    });
                }
            }
            localStorage.setItem('beautydog_bookings', JSON.stringify(mockBookings));
        }
    }

    initMockBookings();

    // -------------------------------------------------------------
    // Elements & Selectors
    // -------------------------------------------------------------
    
    // Navigation & Layout
    const header = document.getElementById('main-header');
    const menuToggle = document.getElementById('menu-toggle');
    const menuClose = document.getElementById('menu-close');
    const mobileNav = document.getElementById('mobile-nav-drawer');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    
    // Modal Booking Elements
    const bookingModal = document.getElementById('booking-modal');
    const closeModaltBtn = document.getElementById('close-modal-btn');
    const bookingTriggers = document.querySelectorAll('.btn-booking-trigger');
    const prevStepBtn = document.getElementById('prev-step-btn');
    const nextStepBtn = document.getElementById('next-step-btn');
    const wizardProgressBar = document.getElementById('wizard-progress-bar');
    const stepIndicators = document.querySelectorAll('.step-indicator');
    const wizardPanes = document.querySelectorAll('.wizard-pane');
    
    // Step 1: Services
    const serviceCards = document.querySelectorAll('.option-card[data-type="service"]');
    const addonCheckboxes = document.querySelectorAll('.addon-checkbox');
    
    // Step 2: Dog Sizes
    const sizeCards = document.querySelectorAll('.size-card[data-type="size"]');
    
    // Step 3: Calendar & Time Slots
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const calendarMonthLabel = document.getElementById('calendar-month-label');
    const calendarDaysGrid = document.getElementById('calendar-days-grid');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const timeSlotsGrid = document.getElementById('time-slots-grid');
    
    // Step 4: Client & Pet Details Form
    const clientForm = document.getElementById('booking-client-form');
    
    // Step 5: Summary Elements
    const sumService = document.getElementById('sum-service');
    const sumAddonsRow = document.getElementById('sum-addons-row');
    const sumAddons = document.getElementById('sum-addons');
    const sumSize = document.getElementById('sum-size');
    const sumPet = document.getElementById('sum-pet');
    const sumDateTime = document.getElementById('sum-datetime');
    const sumClient = document.getElementById('sum-client');
    const sumPrice = document.getElementById('sum-price');
    const whatsappConfirmBtn = document.getElementById('whatsapp-confirm-btn');
    
    // Success Toast
    const successToast = document.getElementById('success-toast');

    // -------------------------------------------------------------
    // Application State Variables
    // -------------------------------------------------------------
    let currentStep = 1;
    let selectedService = "";
    let selectedAddons = [];
    let selectedSize = "";
    let selectedDate = null; // Date Object
    let selectedTime = "";
    
    // Calendar view state
    let viewDate = new Date(CURRENT_YEAR, CURRENT_MONTH, 1); // Start viewing from current month (May 2026)

    // Price Config
    const BASE_PRICES = {
        bagno: 15,
        taglio: 25,
        spa: 35
    };
    
    const ADDON_PRICES = {
        antiparassitario: 5,
        maschera: 7
    };
    
    const SIZE_ADDONS = {
        piccolo: 0,
        medio: 5,
        grande: 15
    };

    // -------------------------------------------------------------
    // Header & Mobile Navigation Menu
    // -------------------------------------------------------------
    
    // Scroll header background blur toggle
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Mobile drawer toggle
    menuToggle.addEventListener('click', () => {
        mobileNav.classList.add('open');
    });

    menuClose.addEventListener('click', () => {
        mobileNav.classList.remove('open');
    });

    // Close mobile drawer when clicking nav links
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileNav.classList.remove('open');
        });
    });

    // -------------------------------------------------------------
    // Booking Modal Opening / Closing
    // -------------------------------------------------------------
    
    // Open booking modal
    bookingTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            
            // If mobile menu open, close it
            mobileNav.classList.remove('open');
            
            // Check if triggered from a specific service card (data-service attribute)
            const targetService = trigger.getAttribute('data-service');
            
            resetWizard();
            
            if (targetService) {
                selectService(targetService);
            }
            
            bookingModal.classList.add('open');
            document.body.style.overflow = 'hidden'; // Lock background scroll
        });
    });

    // Close booking modal
    closeModaltBtn.addEventListener('click', closeModal);
    bookingModal.addEventListener('click', (e) => {
        if (e.target === bookingModal) {
            closeModal();
        }
    });

    function closeModal() {
        bookingModal.classList.remove('open');
        document.body.style.overflow = ''; // Restore scroll
    }

    // -------------------------------------------------------------
    // Wizard Control Flow
    // -------------------------------------------------------------
    
    function resetWizard() {
        currentStep = 1;
        selectedService = "";
        selectedAddons = [];
        selectedSize = "";
        selectedDate = null;
        selectedTime = "";
        
        // Reset steps active styling
        updateStepPane(1);
        
        // Reset card selections
        serviceCards.forEach(c => c.classList.remove('selected'));
        sizeCards.forEach(c => c.classList.remove('selected'));
        addonCheckboxes.forEach(cb => cb.checked = false);
        
        // Reset form inputs
        clientForm.reset();
        
        // Reset time slot selection
        timeSlotsGrid.innerHTML = '<p class="no-date-selected-msg">Seleziona un giorno dal calendario per vedere gli orari.</p>';
        selectedDateDisplay.textContent = "-";
        
        // View Date reset to today
        viewDate = new Date(CURRENT_YEAR, CURRENT_MONTH, 1);
        renderCalendar();
    }

    function selectService(serviceKey) {
        selectedService = serviceKey;
        serviceCards.forEach(card => {
            if (card.getAttribute('data-value') === serviceKey) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    // Handle service card clicks
    serviceCards.forEach(card => {
        card.addEventListener('click', () => {
            const serviceKey = card.getAttribute('data-value');
            selectService(serviceKey);
            
            // Subtle sound/haptic feedback simulation or quick slide to next step
            setTimeout(() => {
                goToStep(2);
            }, 300);
        });
    });

    // Handle addon checkbox toggles
    addonCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const addonKey = checkbox.value;
            if (checkbox.checked) {
                if (!selectedAddons.includes(addonKey)) {
                    selectedAddons.push(addonKey);
                }
            } else {
                selectedAddons = selectedAddons.filter(a => a !== addonKey);
            }
        });
    });

    // Handle dog size clicks
    sizeCards.forEach(card => {
        card.addEventListener('click', () => {
            selectedSize = card.getAttribute('data-value');
            sizeCards.forEach(c => {
                if (c.getAttribute('data-value') === selectedSize) {
                    c.classList.add('selected');
                } else {
                    c.classList.remove('selected');
                }
            });
            
            setTimeout(() => {
                goToStep(3);
            }, 300);
        });
    });

    // Step navigation buttons click
    nextStepBtn.addEventListener('click', () => {
        if (currentStep < 5) {
            if (validateStep(currentStep)) {
                goToStep(currentStep + 1);
            }
        }
    });

    prevStepBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            goToStep(currentStep - 1);
        }
    });

    function validateStep(step) {
        if (step === 1) {
            if (!selectedService) {
                alert("Per favore, seleziona un servizio prima di procedere.");
                return false;
            }
            return true;
        }
        if (step === 2) {
            if (!selectedSize) {
                alert("Per favore, seleziona la taglia del tuo cane per calcolare la tariffa corretta.");
                return false;
            }
            return true;
        }
        if (step === 3) {
            if (!selectedDate || !selectedTime) {
                alert("Per favore, seleziona una data e un orario disponibili per il tuo appuntamento.");
                return false;
            }
            return true;
        }
        if (step === 4) {
            // Check form validity using browser API
            if (!clientForm.checkValidity()) {
                clientForm.reportValidity();
                return false;
            }
            return true;
        }
        return true;
    }

    function goToStep(stepNum) {
        currentStep = stepNum;
        updateStepPane(stepNum);
    }

    function updateStepPane(stepNum) {
        // Toggle Active Panes
        wizardPanes.forEach(pane => {
            const paneStep = parseInt(pane.getAttribute('data-step'));
            if (paneStep === stepNum) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });
        
        // Update Steps Progress Indicators
        stepIndicators.forEach(indicator => {
            const indStep = parseInt(indicator.getAttribute('data-step'));
            if (indStep < stepNum) {
                indicator.classList.remove('active');
                indicator.classList.add('completed');
            } else if (indStep === stepNum) {
                indicator.classList.add('active');
                indicator.classList.remove('completed');
            } else {
                indicator.classList.remove('active', 'completed');
            }
        });
        
        // Progress Bar Width
        const progressPercentage = ((stepNum - 1) / 4) * 100;
        wizardProgressBar.style.width = `${progressPercentage}%`;
        
        // Update Buttons Footer States
        if (stepNum === 1) {
            prevStepBtn.disabled = true;
            nextStepBtn.style.display = 'inline-flex';
            nextStepBtn.innerHTML = 'Avanti <i class="fa-solid fa-arrow-right"></i>';
        } else if (stepNum === 4) {
            prevStepBtn.disabled = false;
            nextStepBtn.style.display = 'inline-flex';
            nextStepBtn.innerHTML = 'Verifica Riepilogo <i class="fa-solid fa-check"></i>';
        } else if (stepNum === 5) {
            prevStepBtn.disabled = false;
            nextStepBtn.style.display = 'none'; // Hide next button, confirm WhatsApp takes over
            renderSummary();
        } else {
            prevStepBtn.disabled = false;
            nextStepBtn.style.display = 'inline-flex';
            nextStepBtn.innerHTML = 'Avanti <i class="fa-solid fa-arrow-right"></i>';
        }
        
        // Auto scroll to top of wizard on step change
        document.querySelector('.wizard-content').scrollTop = 0;
    }

    // -------------------------------------------------------------
    // Interactive Calendar Logic
    // -------------------------------------------------------------
    
    // Month Names
    const MONTH_NAMES = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];
    
    function renderCalendar() {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        
        calendarMonthLabel.textContent = `${MONTH_NAMES[month]} ${year}`;
        calendarDaysGrid.innerHTML = "";
        
        // Get first day of the month and last day of the month
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        // Calculate offset (adjust for Monday starting week)
        // JS Date getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
        let firstDayOfWeekIndex = firstDayOfMonth.getDay() - 1;
        if (firstDayOfWeekIndex < 0) firstDayOfWeekIndex = 6; // Sunday is 6
        
        // Render leading blank spaces
        for (let i = 0; i < firstDayOfWeekIndex; i++) {
            const blank = document.createElement("div");
            blank.className = "calendar-day disabled";
            calendarDaysGrid.appendChild(blank);
        }
        
        // Render actual days
        const totalDays = lastDayOfMonth.getDate();
        for (let day = 1; day <= totalDays; day++) {
            const dayCell = document.createElement("div");
            dayCell.className = "calendar-day";
            dayCell.textContent = day;
            
            const cellDate = new Date(year, month, day);
            const dateString = formatDateString(cellDate);
            
            // Check if cell Date is today or in the past
            // Clear times for proper comparison
            const comparisonDate = new Date(year, month, day);
            const todayCompare = new Date(CURRENT_YEAR, CURRENT_MONTH, CURRENT_DAY);
            
            // Disable past dates, or Sundays
            if (comparisonDate < todayCompare || cellDate.getDay() === 0) {
                dayCell.classList.add("disabled");
            } else {
                // Check if it's the selected date
                if (selectedDate && formatDateString(selectedDate) === dateString) {
                    dayCell.classList.add("selected");
                }
                
                // Highlight today
                if (comparisonDate.getTime() === todayCompare.getTime()) {
                    dayCell.classList.add("today");
                }
                
                // Add click listener
                dayCell.addEventListener("click", async () => {
                    // Update selection state
                    selectedDate = cellDate;
                    selectedTime = ""; // Reset time slot when date changes
                    
                    // Re-render calendar cells to update selection ring
                    const activeCells = calendarDaysGrid.querySelectorAll(".calendar-day:not(.disabled)");
                    activeCells.forEach(cell => cell.classList.remove("selected"));
                    dayCell.classList.add("selected");
                    
                    // Display details
                    const formattedDisplay = cellDate.toLocaleDateString('it-IT', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long' 
                    });
                    selectedDateDisplay.textContent = formattedDisplay;
                    
                    // Render Available Time Slots for this specific day
                    await renderTimeSlots(dateString);
                });
            }
            
            calendarDaysGrid.appendChild(dayCell);
        }
    }
    
    // Handle month switching
    prevMonthBtn.addEventListener('click', () => {
        // Don't view months prior to May 2026
        const minMonth = new Date(CURRENT_YEAR, CURRENT_MONTH, 1);
        const tempViewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
        
        if (tempViewDate >= minMonth) {
            viewDate = tempViewDate;
            renderCalendar();
        }
    });
    
    nextMonthBtn.addEventListener('click', () => {
        // Restrict to max 3 months in advance for booking safety
        const maxMonth = new Date(CURRENT_YEAR, CURRENT_MONTH + 3, 1);
        const tempViewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
        
        if (tempViewDate <= maxMonth) {
            viewDate = tempViewDate;
            renderCalendar();
        }
    });

    // -------------------------------------------------------------
    // Time Slots Rendering & Bookings Check
    // -------------------------------------------------------------
    
    async function renderTimeSlots(dateString) {
        timeSlotsGrid.innerHTML = "";
        
        // Define shop standard schedule
        const slots = ["09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00"];
        
        // Fetch current bookings from DB service
        const bookings = await DbService.getBookingsForDate(dateString);
        
        // Create Morning and Afternoon groups
        const morningGroup = document.createElement("div");
        morningGroup.className = "slots-group";
        morningGroup.innerHTML = `<h4 style="width: 100%; grid-column: span 4; font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700; color: var(--text-dark); margin: 8px 0 12px 0; display: flex; align-items: center; gap: 6px; text-align: left;"><i class="fa-solid fa-cloud-sun text-pink"></i> Mattina</h4>`;
        morningGroup.style.display = "grid";
        morningGroup.style.gridTemplateColumns = "repeat(4, 1fr)";
        morningGroup.style.gap = "10px";
        morningGroup.style.width = "100%";
        morningGroup.style.marginBottom = "20px";
        
        const afternoonGroup = document.createElement("div");
        afternoonGroup.className = "slots-group";
        afternoonGroup.innerHTML = `<h4 style="width: 100%; grid-column: span 4; font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700; color: var(--text-dark); margin: 8px 0 12px 0; display: flex; align-items: center; gap: 6px; text-align: left;"><i class="fa-solid fa-sun text-blue"></i> Pomeriggio</h4>`;
        afternoonGroup.style.display = "grid";
        afternoonGroup.style.gridTemplateColumns = "repeat(4, 1fr)";
        afternoonGroup.style.gap = "10px";
        afternoonGroup.style.width = "100%";

        slots.forEach(slot => {
            const slotBtn = document.createElement("button");
            slotBtn.type = "button";
            slotBtn.className = "time-slot-btn";
            
            // Check if slot is occupied
            const isOccupied = bookings.some(b => b.date === dateString && b.time === slot);
            
            // Also, disable slots in the past if the selected date is TODAY
            const isToday = dateString === formatDateString(TODAY_DATE);
            let isPastHour = false;
            
            if (isToday) {
                const currentHour = 22; // local simulated time hour
                const slotHour = parseInt(slot.split(":")[0]);
                if (slotHour <= currentHour) {
                    isPastHour = true;
                }
            }

            if (isOccupied || isPastHour) {
                slotBtn.classList.add("disabled");
                slotBtn.disabled = true;
                slotBtn.innerHTML = `<span>${slot}</span><small style="display:block; font-size:0.6rem; color:#d32f2f; font-weight:700; margin-top:2px;">Occupato</small>`;
                if (isOccupied) {
                    slotBtn.title = "Orario già prenotato";
                } else {
                    slotBtn.title = "Orario passato";
                }
            } else {
                slotBtn.innerHTML = `<span>${slot}</span><small style="display:block; font-size:0.6rem; color:#388e3c; font-weight:700; margin-top:2px;">Libero</small>`;
                
                // If it is the selected slot, highlight it
                if (selectedTime === slot) {
                    slotBtn.classList.add("selected");
                }
                
                slotBtn.addEventListener("click", () => {
                    selectedTime = slot;
                    
                    const buttons = timeSlotsGrid.querySelectorAll(".time-slot-btn:not(.disabled)");
                    buttons.forEach(btn => btn.classList.remove("selected"));
                    slotBtn.classList.add("selected");
                });
            }
            
            const hour = parseInt(slot.split(":")[0]);
            if (hour < 13) {
                morningGroup.appendChild(slotBtn);
            } else {
                afternoonGroup.appendChild(slotBtn);
            }
        });

        timeSlotsGrid.appendChild(morningGroup);
        timeSlotsGrid.appendChild(afternoonGroup);
    }

    // Helper functions
    function formatDateString(dateObj) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // -------------------------------------------------------------
    // Pricing Calculator
    // -------------------------------------------------------------
    
    function calculateTotalPrice() {
        if (!selectedService || !selectedSize) return 0;
        
        let base = BASE_PRICES[selectedService];
        
        // Add addons prices
        let addonsTotal = 0;
        selectedAddons.forEach(addon => {
            addonsTotal += ADDON_PRICES[addon] || 0;
        });
        
        // Dog Size flat adjustments
        let sizeAddon = SIZE_ADDONS[selectedSize] || 0;
        
        let total = base + addonsTotal + sizeAddon;

        // Taxi Dog service
        const taxiCheck = document.getElementById('taxi-dog-check');
        if (taxiCheck && taxiCheck.checked) {
            total += 10;
        }

        return total;
    }

    // -------------------------------------------------------------
    // Step 5: Riepilogo (Summary) & WhatsApp Integration
    // -------------------------------------------------------------
    
    const SERVICE_LABELS = {
        bagno: "Bagno & Igiene",
        taglio: "Taglio & Tosatura",
        spa: "SPA & Ozonoterapia"
    };
    
    const SIZE_LABELS = {
        piccolo: "Piccola (Fino a 10kg)",
        medio: "Media (10-25kg)",
        grande: "Grande (Oltre 25kg)"
    };
    
    const ADDON_LABELS = {
        antiparassitario: "Antiparassitario",
        maschera: "Maschera Nutriente Keratina"
    };

    function renderSummary() {
        const serviceName = SERVICE_LABELS[selectedService];
        const sizeName = SIZE_LABELS[selectedSize];
        
        const ownerName = document.getElementById('client-name').value;
        const petName = document.getElementById('pet-name').value;
        const breed = document.getElementById('pet-breed').value;
        const petAge = document.getElementById('pet-age').value;
        
        // Format Date Time
        const dateFormatted = selectedDate.toLocaleDateString('it-IT', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        const fullDateTime = `${dateFormatted} alle ore ${selectedTime}`;
        
        // Populate DOM elements
        sumService.textContent = serviceName;
        sumSize.textContent = sizeName;
        sumPet.textContent = `${petName} (${breed}, ${petAge} anni)`;
        sumDateTime.textContent = fullDateTime;
        sumClient.textContent = ownerName;
        
        // Addons Row
        if (selectedAddons.length > 0) {
            sumAddonsRow.style.display = 'flex';
            sumAddons.textContent = selectedAddons.map(a => ADDON_LABELS[a]).join(", ");
        } else {
            sumAddonsRow.style.display = 'none';
        }

        // Taxi Row
        const taxiCheck = document.getElementById('taxi-dog-check');
        const sumTaxiRow = document.getElementById('sum-taxi-row');
        if (taxiCheck && taxiCheck.checked && sumTaxiRow) {
            sumTaxiRow.style.display = 'flex';
        } else if (sumTaxiRow) {
            sumTaxiRow.style.display = 'none';
        }
        
        // Price
        const total = calculateTotalPrice();
        sumPrice.textContent = `€${total}`;
    }

    // Confirm Booking and send to WhatsApp
    whatsappConfirmBtn.addEventListener('click', async () => {
        const ownerName = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const petName = document.getElementById('pet-name').value;
        const breed = document.getElementById('pet-breed').value;
        const petAge = document.getElementById('pet-age').value;
        const zone = document.getElementById('client-zone').value;
        const notes = document.getElementById('booking-notes').value || "Nessuna";
        
        const serviceName = SERVICE_LABELS[selectedService];
        const sizeName = SIZE_LABELS[selectedSize];
        const dateFormatted = selectedDate.toLocaleDateString('it-IT', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        
        const addonsList = selectedAddons.map(a => ADDON_LABELS[a]).join(", ");
        const addonsText = addonsList ? `\n- Extra Aggiuntivi: ${addonsList}` : "";
        
        const taxiCheck = document.getElementById('taxi-dog-check');
        const taxiText = (taxiCheck && taxiCheck.checked) ? "\n- Servizio Navetta (Taxi Dog): Sì (+ €10)" : "";

        const total = calculateTotalPrice();
        const dateString = formatDateString(selectedDate);
        
        // 1. Create WhatsApp Message Text
        const messageText = 
`Ciao Carol! Vorrei prenotare un appuntamento per il mio cane da BeautyDog.
 
\u{1F436} *DETTAGLI CANE:*
- Nome: ${petName}
- Razza: ${breed}
- Taglia: ${sizeName}
- Età: ${petAge} anni
 
\u{2702} *SERVIZIO RICHIESTO:*
- Trattamento: ${serviceName}${addonsText}${taxiText}
- Prezzo Stimato: €${total}
 
\u{1F4C5} *DATA E ORA RICHIESTE:*
- Giorno: ${dateFormatted}
- Orario: ${selectedTime}
 
\u{1F464} *CONTATTI PROPRIETARIO:*
- Nome: ${ownerName}
- Telefono: ${phone}
- Provenienza: ${zone}
- Note: ${notes}
 
Attendo tua conferma dell'appuntamento! Grazie mille!`;
 
        // 2. Save appointment to database / local storage
        const newBooking = {
            date: dateString,
            time: selectedTime,
            service: serviceName,
            size: SIZE_LABELS[selectedSize],
            petName: petName,
            petBreed: breed,
            petAge: petAge,
            clientName: ownerName,
            clientPhone: phone,
            clientZone: zone,
            notes: notes,
            price: total,
            taxiDog: taxiCheck ? taxiCheck.checked : false
        };
        await DbService.addBooking(newBooking);

        // 3. Show Success Toast Notification
        showSuccessToast();

        // 4. Close Modal
        closeModal();

        // 5. Open WhatsApp Window
        const encodedMessage = encodeURIComponent(messageText);
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${SALON_PHONE}&text=${encodedMessage}`;
        
        setTimeout(() => {
            window.open(whatsappUrl, '_blank');
        }, 1000);
    });

    function showSuccessToast() {
        successToast.classList.add('show');
        setTimeout(() => {
            successToast.classList.remove('show');
        }, 4000);
    }

    // -------------------------------------------------------------
    // Conversational Chatbot (Buddy) Logic
    // -------------------------------------------------------------
    const chatContainer = document.getElementById('buddy-chat-container');
    const chatTrigger = document.getElementById('buddy-chat-trigger');
    const chatWindow = document.getElementById('buddy-chat-window');
    const chatCloseBtn = document.getElementById('buddy-close-btn');
    const chatMessages = document.getElementById('buddy-chat-messages');
    const chatFooter = document.getElementById('buddy-chat-footer');
    
    let chatStep = 0;
    let chatOpenedOnce = false;
    let chatHistory = [];
    
    let buddyData = {
        clientName: "",
        petName: "",
        petBreed: "",
        size: "",
        service: "",
        zone: "",
        phone: ""
    };

    if (chatTrigger && chatWindow && chatCloseBtn) {
        chatTrigger.addEventListener('click', () => {
            chatWindow.classList.toggle('open');
            const triggerBadge = chatTrigger.querySelector('.buddy-badge-pulse');
            if (triggerBadge) triggerBadge.style.display = 'none';
            
            if (chatWindow.classList.contains('open') && !chatOpenedOnce) {
                chatOpenedOnce = true;
                startBuddyConversation();
            }
        });
        
        chatCloseBtn.addEventListener('click', () => {
            chatWindow.classList.remove('open');
        });
    }

    function addBotMessage(text, delayMs = 600) {
        showTypingIndicator();
        setTimeout(() => {
            removeTypingIndicator();
            const msg = document.createElement('div');
            msg.className = 'buddy-message bot';
            msg.innerHTML = text;
            chatMessages.appendChild(msg);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, delayMs);
    }

    function addUserMessage(text) {
        const msg = document.createElement('div');
        msg.className = 'buddy-message user';
        msg.textContent = text;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTypingIndicator() {
        removeTypingIndicator();
        const typing = document.createElement('div');
        typing.className = 'buddy-typing';
        typing.id = 'buddy-typing';
        typing.innerHTML = `
            <div class="buddy-dot"></div>
            <div class="buddy-dot"></div>
            <div class="buddy-dot"></div>
        `;
        chatMessages.appendChild(typing);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        const typing = document.getElementById('buddy-typing');
        if (typing && typing.parentNode) {
            typing.parentNode.removeChild(typing);
        }
    }

    function renderTextPrompt(placeholder, type = "text", callback) {
        chatFooter.innerHTML = `
            <form id="buddy-text-form" class="buddy-input-wrapper">
                <input type="${type}" class="buddy-text-input" id="buddy-text-input" placeholder="${placeholder}" required autocomplete="off">
                <button type="submit" class="buddy-send-btn">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </form>
        `;
        
        setTimeout(() => {
            const input = document.getElementById('buddy-text-input');
            if (input) input.focus();
        }, 100);

        const form = document.getElementById('buddy-text-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('buddy-text-input');
            const val = input.value.trim();
            if (val) {
                addUserMessage(val);
                callback(val);
            }
        });
    }

    function renderOptions(options, callback) {
        chatFooter.innerHTML = "";
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'buddy-option-btn';
            btn.textContent = opt.label;
            btn.addEventListener('click', () => {
                addUserMessage(opt.label);
                callback(opt.value, opt.label);
            });
            chatFooter.appendChild(btn);
        });
    }

    function startBuddyConversation() {
        chatStep = 0;
        addBotMessage("Ciao! 🐶 Io sono <strong>Buddy</strong>, l'assistente virtuale di BeautyDog. Come posso aiutarti oggi?");
        setTimeout(() => {
            renderWelcomeOptions();
        }, 800);
    }

    function renderWelcomeOptions() {
        renderOptions([
            { label: "Prenota Trattamento 📅", value: "booking" },
            { label: "Fai una Domanda 💬", value: "faq" }
        ], (val, label) => {
            if (val === "booking") {
                askClientName();
            } else {
                startFAQMode();
            }
        });
    }

    function startFAQMode() {
        chatStep = 100;
        addBotMessage("Chiedimi pure qualsiasi cosa sul salone! 🐶 Ad esempio: <i>orari, prezzi dei trattamenti, parcheggio, prodotti bio, o la nostra garanzia senza stress</i>. Cosa desideri sapere?");
        setTimeout(() => {
            renderFAQPrompt();
        }, 800);
    }

    function renderFAQPrompt() {
        renderTextPrompt("Chiedi pure a Buddy...", "text", (val) => {
            processFAQ(val);
        });
    }

    async function getGeminiReply(userMessage) {
        if (chatHistory.length === 0) {
            chatHistory.push({ role: 'model', parts: [{ text: "Ciao! 🐶 Io sono Buddy, l'assistente virtuale di BeautyDog. Come posso aiutarti oggi?" }] });
        }
        
        chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });
        
        if (!buddyApiKey || buddyApiKey === "YOUR_GEMINI_API_KEY" || buddyApiKey.trim() === "") {
            console.log("Gemini API Key non configurata. Utilizzo del fallback locale.");
            return getLocalFallbackReply(userMessage);
        }
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${buddyApiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: chatHistory,
                    systemInstruction: {
                        parts: [
                            {
                                text: buddySystemPrompt
                            }
                        ]
                    },
                    generationConfig: {
                        maxOutputTokens: 250,
                        temperature: 0.7
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            
            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                const reply = data.candidates[0].content.parts[0].text.trim();
                chatHistory.push({ role: 'model', parts: [{ text: reply }] });
                return reply;
            } else {
                throw new Error("Formato risposta non valido");
            }
        } catch (e) {
            console.error("Errore chiamata Gemini API:", e);
            return getLocalFallbackReply(userMessage);
        }
    }

    function getLocalFallbackReply(question) {
        const q = question.toLowerCase().trim();
        let reply = "";
        
        if (q.includes("orar") || q.includes("quando") || q.includes("apert")) {
            reply = "🕒 <strong>Orari di Apertura:</strong><br>Siamo aperti dal Lunedì al Venerdì dalle 09:00 alle 13:00 e dalle 15:00 alle 19:00.<br>Il Sabato dalle 09:00 alle 13:00.<br>Domenica siamo chiusi.";
        } else if (q.includes("indirizz") || q.includes("dove") || q.includes("posizion") || q.includes("via") || q.includes("palma") || q.includes("trov")) {
            reply = "📍 <strong>Dove siamo:</strong><br>Il salone è in <strong>Via IV Novembre, 45</strong> a Palma di Montechiaro (AG).<br>Trovi la mappa stradale interattiva in fondo alla pagina per raggiungerci facilmente!";
        } else if (q.includes("parchegg")) {
            reply = "🚗 <strong>Parcheggio:</strong><br>Nessuno stress! C'è un comodo <strong>parcheggio clienti gratuito</strong> direttamente di fronte all'ingresso del salone in Via IV Novembre.";
        } else if (q.includes("prezz") || q.includes("cost") || q.includes("tariff") || q.includes("quant")) {
            reply = "💰 <strong>Prezzi di partenza:</strong><br>• <strong>Bagno & Igiene:</strong> da 25€<br>• <strong>Taglio & Tosatura:</strong> da 40€<br>• <strong>SPA & Ozonoterapia:</strong> da 35€<br><br>Il prezzo varia in base a razza, taglia e pelo. Digita 'prenota' per iniziare la prenotazione guidata!";
        } else if (q.includes("gabbie") || q.includes("stress") || q.includes("senza stress") || q.includes("gabbia")) {
            reply = "🌿 <strong>Salone Senza Stress:</strong><br>Lavoriamo con <strong>un solo cane alla volta</strong> e non usiamo <strong>mai gabbie di attesa</strong>. L'ambiente è sereno, rilassato e focalizzato solo sul benessere del tuo amico.";
        } else if (q.includes("shampoo") || q.includes("prodott") || q.includes("cosmetic") || q.includes("bio") || q.includes("natural")) {
            reply = "🌱 <strong>Cosmetici Naturali:</strong><br>Utilizziamo cosmetici 100% bio, ipoallergenici e vegani a base di principi attivi naturali come Camomilla, Olio di Neem e Proteine della Seta.";
        } else if (q.includes("timbri") || q.includes("fidelity") || q.includes("tessera") || q.includes("fedelt")) {
            reply = "🎁 <strong>Tessera Fedeltà:</strong><br>Ogni 5 trattamenti completati ricevi un omaggio speciale (es. ozonoterapia gratuita)! Puoi simulare la raccolta punti nella sezione 'Beauty Card' sul sito.";
        } else if (q.includes("telefon") || q.includes("contatt") || q.includes("cellul") || q.includes("chiam") || q.includes("mail") || q.includes("whatsapp")) {
            reply = "📞 <strong>Contatti:</strong><br>• WhatsApp/Telefono: <strong>+39 320 882 1749</strong><br>• Email: info@beautydogpalma.it<br>• Sede: Via IV Novembre, 45, Palma di Montechiaro (AG).";
        } else if (q.includes("prenot") || q.includes("appuntament") || q.includes("fiss")) {
            return "[BOOK]"; 
        } else if (q.includes("ciao") || q.includes("buongiorno") || q.includes("buonasera") || q.includes("ehi")) {
            reply = "Ciao! 😊 Come posso aiutarti? Scrivimi pure una domanda (es. 'prezzi', 'orari', 'parcheggio') o digita 'prenota' per fissare un appuntamento.";
        } else if (q.includes("grazie") || q.includes("perfetto") || q.includes("ok") || q.includes("ottimo")) {
            reply = "Di nulla! 😊 Resto a tua disposizione. Desideri sapere altro sul salone o preferisci prenotare?";
        } else {
            reply = "🐶 Scusa, non ho capito. Puoi chiedermi di: <strong>orari, prezzi, indirizzo, parcheggio, garanzia senza stress o prodotti bio</strong>.<br><br><i>Digita 'prenota' in qualsiasi momento per fissare un appuntamento!</i>";
        }
        
        chatHistory.push({ role: 'model', parts: [{ text: reply }] });
        return reply;
    }

    async function processFAQ(question) {
        const userMsg = question.trim();
        if (!userMsg) return;
        
        showTypingIndicator();
        
        const reply = await getGeminiReply(userMsg);
        
        removeTypingIndicator();
        
        if (reply === "[BOOK]" || reply.includes("[BOOK]") || userMsg.toLowerCase().includes("prenot") || userMsg.toLowerCase().includes("appuntament")) {
            const cleanReply = reply === "[BOOK]" ? "Ottimo! Avvio la procedura guidata di prenotazione..." : reply.replace("[BOOK]", "").trim();
            addBotMessage(cleanReply, 100);
            setTimeout(() => {
                askClientName();
            }, 1000);
            return;
        }
        
        addBotMessage(reply, 100);
        
        setTimeout(() => {
            renderFAQFollowUp();
        }, 1000);
    }

    function renderFAQFollowUp() {
        renderOptions([
            { label: "Prenota Trattamento 📅", value: "booking" },
            { label: "Menu Principale ↩️", value: "menu" }
        ], (val, label) => {
            if (val === "booking") {
                askClientName();
            } else {
                startBuddyConversation();
            }
        });
        
        const typeContainer = document.createElement('div');
        typeContainer.style.width = '100%';
        typeContainer.style.marginTop = '8px';
        typeContainer.innerHTML = `
            <form id="buddy-faq-form" class="buddy-input-wrapper">
                <input type="text" class="buddy-text-input" id="buddy-faq-input" placeholder="Chiedi qualcos'altro..." required autocomplete="off">
                <button type="submit" class="buddy-send-btn">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </form>
        `;
        chatFooter.appendChild(typeContainer);
        
        const faqForm = document.getElementById('buddy-faq-form');
        faqForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('buddy-faq-input');
            const val = input.value.trim();
            if (val) {
                addUserMessage(val);
                processFAQ(val);
            }
        });
    }

    function askClientName() {
        chatStep = 1;
        addBotMessage("Come ti chiami?");
        renderTextPrompt("Il tuo nome...", "text", (val) => {
            buddyData.clientName = val;
            askPetName();
        });
    }

    function askPetName() {
        chatStep = 2;
        addBotMessage(`Piacere di conoscerti, ${buddyData.clientName}! Come si chiama il tuo pelosetto?`);
        renderTextPrompt("Nome del cane...", "text", (val) => {
            buddyData.petName = val;
            askPetBreed();
        });
    }

    function askPetBreed() {
        chatStep = 3;
        addBotMessage(`Che bel nome! E di che razza è ${buddyData.petName}?`);
        renderOptions([
            { label: "Meticcio \u{1F436}", value: "Meticcio" },
            { label: "Barboncino \u{1F429}", value: "Barboncino" },
            { label: "Maltese \u{1F40B}", value: "Maltese" },
            { label: "Chihuahua", value: "Chihuahua" },
            { label: "Labrador", value: "Labrador" },
            { label: "Altra razza... \u{270F}", value: "Altro" }
        ], (val, label) => {
            if (val === "Altro") {
                addBotMessage("Scrivimi pure la razza del tuo cane:");
                renderTextPrompt("Es. Cocker, Golden Retriever...", "text", (customBreed) => {
                    buddyData.petBreed = customBreed;
                    askPetAge();
                });
            } else {
                buddyData.petBreed = val;
                askPetAge();
            }
        });
    }

    function askPetAge() {
        chatStep = 4;
        addBotMessage(`Quanti anni ha ${buddyData.petName}? (Inserisci un numero, es. 3)`);
        renderTextPrompt("Età in anni...", "number", (val) => {
            buddyData.petAge = val;
            askPetSize();
        });
    }

    function askPetSize() {
        chatStep = 5;
        addBotMessage(`Capito! Qual è la taglia di ${buddyData.petName}?`);
        renderOptions([
            { label: "Piccolo (Fino a 10 kg)", value: "piccolo" },
            { label: "Medio (10-25 kg)", value: "medio" },
            { label: "Grande (Oltre 25 kg)", value: "grande" }
        ], (val, label) => {
            buddyData.size = val;
            askService();
        });
    }

    function askService() {
        chatStep = 6;
        addBotMessage(`Perfetto! Di che trattamento ha bisogno ${buddyData.petName}?`);
        renderOptions([
            { label: "Bagno & Igiene \u{1F9FC}", value: "bagno" },
            { label: "Taglio & Tosatura \u{2702}", value: "taglio" },
            { label: "SPA & Ozonoterapia \u{1F6C1}", value: "spa" }
        ], (val, label) => {
            buddyData.service = val;
            askZone();
        });
    }

    function askZone() {
        chatStep = 7;
        addBotMessage("Ottima scelta. Da quale zona ci contatti?");
        renderOptions([
            { label: "Palma Centro", value: "Palma Centro" },
            { label: "Villaggio Giordano", value: "Villaggio Giordano" },
            { label: "Marina di Palma", value: "Marina di Palma" },
            { label: "Licata", value: "Licata" },
            { label: "Campobello", value: "Campobello" },
            { label: "Altra zona... \u{270F}", value: "Altro" }
        ], (val, label) => {
            if (val === "Altro") {
                addBotMessage("Scrivimi pure la tua zona o comune di provenienza:");
                renderTextPrompt("Es. Naro, Camastra...", "text", (customZone) => {
                    buddyData.zone = customZone;
                    askPhone();
                });
            } else {
                buddyData.zone = val;
                askPhone();
            }
        });
    }

    function askPhone() {
        chatStep = 8;
        addBotMessage("Ultimo dettaglio! Lasciami un numero di telefono per poterti ricontattare:");
        renderTextPrompt("Es. 3201234567", "tel", (val) => {
            buddyData.phone = val;
            concludeChat();
        });
    }

    function concludeChat() {
        chatStep = 9;
        addBotMessage(`Grazie mille, ${buddyData.clientName}! Ho raccolto tutti i dati per la prenotazione di ${buddyData.petName}.`);
        setTimeout(() => {
            addBotMessage("Clicca sul pulsante qui sotto per scegliere la data e l'orario sul nostro calendario e inviare la richiesta!");
            chatFooter.innerHTML = `
                <button class="btn btn-primary w-full" id="buddy-wizard-btn">
                    Scegli Data e Ora <i class="fa-solid fa-calendar-days"></i>
                </button>
            `;
            const finishBtn = document.getElementById('buddy-wizard-btn');
            finishBtn.addEventListener('click', () => {
                // 1. Close chatbot window
                chatWindow.classList.remove('open');
                
                // 2. Reset wizard values
                resetWizard();
                
                // 3. Prepopulate DOM fields
                document.getElementById('client-name').value = buddyData.clientName;
                document.getElementById('client-phone').value = buddyData.phone;
                document.getElementById('pet-name').value = buddyData.petName;
                document.getElementById('pet-breed').value = buddyData.petBreed;
                document.getElementById('pet-age').value = buddyData.petAge;
                document.getElementById('client-zone').value = buddyData.zone;
                
                // Select service card
                selectService(buddyData.service);
                
                // Select pet size card
                selectedSize = buddyData.size;
                sizeCards.forEach(c => {
                    if (c.getAttribute('data-value') === buddyData.size) {
                        c.classList.add('selected');
                    } else {
                        c.classList.remove('selected');
                    }
                });
                
                // Open wizard modal
                bookingModal.classList.add('open');
                document.body.style.overflow = 'hidden';
                
                // Go directly to Step 3 (Calendar selection)
                goToStep(3);
            });
        }, 1000);
    }

    // Before/After slider event listener (Groomies Chicago)
    const rangeInput = document.querySelector('.before-after-range');
    const beforeContainer = document.querySelector('.before-image-container');
    const handle = document.querySelector('.slider-handle');
    const sliderContainer = document.querySelector('.slider-container');
    const sliderBeforeImg = document.getElementById('slider-before-img');
    
    function adjustSliderImageWidth() {
        if (sliderContainer && sliderBeforeImg) {
            const width = sliderContainer.offsetWidth;
            if (width > 0) {
                sliderBeforeImg.style.width = `${width}px`;
            } else {
                // Fallback to parent container width or standard 600px
                const parentWidth = sliderContainer.parentElement ? sliderContainer.parentElement.offsetWidth : 0;
                sliderBeforeImg.style.width = parentWidth > 0 ? `${parentWidth}px` : '600px';
            }
        }
    }
    
    if (rangeInput && beforeContainer && handle) {
        rangeInput.addEventListener('input', (e) => {
            const value = e.target.value;
            beforeContainer.style.width = `${value}%`;
            handle.style.left = `${value}%`;
            adjustSliderImageWidth(); // Ensure width aligns correctly during sliding
        });
        
        // Initial setup and responsive resizing
        adjustSliderImageWidth();
        window.addEventListener('load', adjustSliderImageWidth);
        window.addEventListener('resize', adjustSliderImageWidth);
    }

    // Taxi dog change listener (La Vecchia Fattoria)
    const taxiCheckEl = document.getElementById('taxi-dog-check');
    if (taxiCheckEl) {
        taxiCheckEl.addEventListener('change', () => {
            renderSummary();
        });
    }

    // Hair Type Recommendation Widget (Fido Chic)
    const hairBtns = document.querySelectorAll('.hair-btn');
    const mainServiceCards = document.querySelectorAll('.service-card');
    
    if (hairBtns.length > 0 && mainServiceCards.length > 0) {
        hairBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                hairBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const hairType = btn.getAttribute('data-hair');
                
                // Clear highlights, dims, badges and active states
                mainServiceCards.forEach(card => {
                    card.classList.remove('highlighted');
                    card.classList.remove('highlighted-blue');
                    card.classList.remove('highlighted-purple');
                    card.classList.remove('dimmed');
                    card.classList.remove('active'); // Temporarily remove standard highlight during filters
                    const existingBadge = card.querySelector('.recommended-badge');
                    if (existingBadge && existingBadge.parentNode) {
                        existingBadge.parentNode.removeChild(existingBadge);
                    }
                });
                
                if (hairType === 'tutti') {
                    // Restore default active class to Taglio & Tosatura card
                    const taglioCard = document.getElementById('service-card-taglio');
                    if (taglioCard) {
                        taglioCard.classList.add('active');
                    }
                    return; // Reset state
                }
                
                mainServiceCards.forEach(card => {
                    const cardId = card.id;
                    let isMatch = false;
                    let highlightClass = 'highlighted';
                    
                    if (hairType === 'corto' && cardId === 'service-card-bagno') {
                        isMatch = true;
                        highlightClass = 'highlighted';
                    } else if (hairType === 'lungo' && cardId === 'service-card-taglio') {
                        isMatch = true;
                        highlightClass = 'highlighted-blue';
                    } else if (hairType === 'sensibile' && cardId === 'service-card-spa') {
                        isMatch = true;
                        highlightClass = 'highlighted-purple';
                    }
                    
                    if (isMatch) {
                        card.classList.add(highlightClass);
                        const badge = document.createElement('div');
                        badge.className = 'recommended-badge';
                        badge.innerHTML = '<i class="fa-solid fa-sparkles"></i> Scelta Consigliata';
                        card.appendChild(badge);
                    } else {
                        card.classList.add('dimmed');
                    }
                });
            });
        });
    }

    // Visual Loyalty Card Simulator (Wash Dog)
    let currentStamps = 3;
    const btnSimulate = document.getElementById('btn-simulate-stamp');
    const btnReset = document.getElementById('btn-reset-stamp');
    const slot4 = document.getElementById('stamp-slot-4');
    const slot5 = document.getElementById('stamp-slot-5');
    const statusText = document.getElementById('loyalty-status-text');
    const alertMsg = document.getElementById('loyalty-alert-msg');
    const loyaltyCard = document.querySelector('.loyalty-card-premium');
    
    function triggerLoyaltyConfetti(container) {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const emojis = ["⭐", "✨", "🎉", "🐶", "🐾", "🦴", "💖"];
        const scrollX = window.scrollX || window.pageXOffset || 0;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        
        for (let i = 0; i < 35; i++) {
            const particle = document.createElement('div');
            particle.className = 'star-particle';
            particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            
            const x = (Math.random() - 0.5) * 240;
            const y = (Math.random() - 0.6) * 180 - 40;
            const rot = Math.random() * 360 + 360;
            
            particle.style.setProperty('--x', `${x}px`);
            particle.style.setProperty('--y', `${y}px`);
            particle.style.setProperty('--rot', `${rot}deg`);
            
            particle.style.left = `${rect.left + rect.width / 2 + scrollX}px`;
            particle.style.top = `${rect.top + rect.height / 2 + scrollY}px`;
            
            document.body.appendChild(particle);
            
            setTimeout(() => {
                if (particle && particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 800);
        }
    }
    
    if (btnSimulate && btnReset && slot4 && slot5 && statusText && alertMsg && loyaltyCard) {
        btnSimulate.addEventListener('click', () => {
            if (currentStamps === 3) {
                currentStamps = 4;
                slot4.classList.add('stamped');
                slot4.querySelector('.stamp-date').textContent = 'Oggi';
                statusText.textContent = '4 di 5 Timbri';
                
                alertMsg.style.display = 'block';
                alertMsg.className = 'alert-info';
                alertMsg.style.background = 'rgba(93, 188, 249, 0.15)';
                alertMsg.style.color = 'var(--blue-dark)';
                alertMsg.style.border = '1px solid rgba(93, 188, 249, 0.3)';
                alertMsg.innerHTML = '<i class="fa-solid fa-circle-info"></i> Timbro aggiunto! Manca solo 1 appuntamento per ricevere il tuo omaggio.';
            } else if (currentStamps === 4) {
                currentStamps = 5;
                slot5.classList.add('stamped');
                slot5.querySelector('.stamp-date').textContent = 'Sbloccato!';
                statusText.textContent = 'Tessera Completa!';
                
                alertMsg.style.display = 'block';
                alertMsg.className = 'alert-success';
                alertMsg.style.background = 'rgba(76, 175, 80, 0.15)';
                alertMsg.style.color = '#2e7d32';
                alertMsg.style.border = '1px solid rgba(76, 175, 80, 0.3)';
                alertMsg.innerHTML = '🎉 <strong>Complimenti!</strong> Hai completato la tessera fedeltà! Il trattamento igienizzante dentale all\'ozono è <strong>IN OMAGGIO</strong> per il tuo prossimo appuntamento!';
                
                triggerLoyaltyConfetti(loyaltyCard);
            } else if (currentStamps === 5) {
                // Shake the card visually to show it's already completed
                loyaltyCard.classList.add('shake-card');
                setTimeout(() => {
                    loyaltyCard.classList.remove('shake-card');
                }, 500);
                
                alertMsg.style.display = 'block';
                alertMsg.className = 'alert-warning';
                alertMsg.style.background = 'rgba(255, 152, 0, 0.15)';
                alertMsg.style.color = '#e65100';
                alertMsg.style.border = '1px solid rgba(255, 152, 0, 0.3)';
                alertMsg.innerHTML = '✨ <strong>Tessera già completata!</strong> Clicca su "Azzera" per ricominciare la simulazione.';
            }
        });
        
        btnReset.addEventListener('click', () => {
            currentStamps = 3;
            slot4.classList.remove('stamped');
            slot4.querySelector('.stamp-date').textContent = 'Da fare';
            
            slot5.classList.remove('stamped');
            slot5.querySelector('.stamp-date').textContent = 'Regalo';
            
            statusText.textContent = '3 di 5 Timbri';
            alertMsg.style.display = 'none';
        });

        // Allow clicking directly on the slot 4 or 5 elements for simulated direct stamp interaction
        slot4.addEventListener('click', () => {
            if (currentStamps === 3) {
                btnSimulate.click();
            }
        });
        
        slot5.addEventListener('click', () => {
            if (currentStamps === 4) {
                btnSimulate.click();
            }
        });
    }

    // Video Tour Modal (DogLover Bresso)
    const videoModal = document.getElementById('video-tour-modal');
    const videoCloseBtn = document.getElementById('close-video-modal-btn');
    const videoTrigger = document.getElementById('about-video-trigger');
    const videoPlayBtn = document.getElementById('video-play-btn');
    const videoMuteBtn = document.getElementById('video-mute-btn');
    const videoProgressFill = document.getElementById('video-progress-fill');
    const videoProgressContainer = document.getElementById('video-progress-bar-container');
    const videoTimeText = document.getElementById('video-time-text');
    const videoOverlay = document.getElementById('video-player-overlay');
    const videoSlides = document.querySelectorAll('.video-slide');
    const videoSlideLabel = document.getElementById('video-slide-label');
    
    let isVideoPlaying = false;
    let videoCurrentTime = 0;
    const videoTotalTime = 15;
    let videoInterval = null;
    let isMuted = false;
    
    function updateVideoState() {
        const percent = (videoCurrentTime / videoTotalTime) * 100;
        if (videoProgressFill) videoProgressFill.style.width = `${percent}%`;
        
        const sec = Math.floor(videoCurrentTime);
        if (videoTimeText) videoTimeText.textContent = `0:${sec.toString().padStart(2, '0')} / 0:15`;
        
        let activeSlideIndex = 1;
        let slideName = "Zona Taglio & Tosatura";
        
        if (videoCurrentTime >= 5 && videoCurrentTime < 10) {
            activeSlideIndex = 2;
            slideName = "Zona Lavaggio & Cura";
        } else if (videoCurrentTime >= 10) {
            activeSlideIndex = 3;
            slideName = "Vasca SPA all'Ozono";
        }
        
        if (videoSlideLabel) videoSlideLabel.textContent = slideName;
        
        videoSlides.forEach(slide => {
            const slideId = parseInt(slide.getAttribute('data-slide'));
            if (slideId === activeSlideIndex) {
                slide.classList.add('active');
                slide.style.opacity = '1';
            } else {
                slide.classList.remove('active');
                slide.style.opacity = '0';
            }
        });
    }
    
    function playVideo() {
        isVideoPlaying = true;
        if (videoOverlay) {
            videoOverlay.style.opacity = '0';
            videoOverlay.style.pointerEvents = 'none';
        }
        if (videoPlayBtn) videoPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        
        videoInterval = setInterval(() => {
            videoCurrentTime += 0.1;
            if (videoCurrentTime >= videoTotalTime) {
                videoCurrentTime = 0;
                pauseVideo();
                if (videoOverlay) {
                    videoOverlay.style.opacity = '1';
                    videoOverlay.style.pointerEvents = 'auto';
                }
            }
            updateVideoState();
        }, 100);
    }
    
    function pauseVideo() {
        isVideoPlaying = false;
        clearInterval(videoInterval);
        if (videoPlayBtn) videoPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
    
    if (videoTrigger && videoModal && videoCloseBtn) {
        videoTrigger.addEventListener('click', () => {
            videoModal.classList.add('open');
            document.body.style.overflow = 'hidden';
            adjustSliderImageWidth(); // Make sure slide widths match container
            updateVideoState();
        });
        
        videoCloseBtn.addEventListener('click', () => {
            videoModal.classList.remove('open');
            document.body.style.overflow = '';
            pauseVideo();
            videoCurrentTime = 0;
            updateVideoState();
            if (videoOverlay) {
                videoOverlay.style.opacity = '1';
                videoOverlay.style.pointerEvents = 'auto';
            }
        });
        
        if (videoPlayBtn) {
            videoPlayBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isVideoPlaying) {
                    pauseVideo();
                } else {
                    playVideo();
                }
            });
        }
        
        if (videoOverlay) {
            videoOverlay.addEventListener('click', () => {
                playVideo();
            });
        }
        
        if (videoMuteBtn) {
            videoMuteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                isMuted = !isMuted;
                if (isMuted) {
                    videoMuteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
                } else {
                    videoMuteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                }
            });
        }
        
        if (videoProgressContainer) {
            videoProgressContainer.addEventListener('click', (e) => {
                e.stopPropagation();
                const rect = videoProgressContainer.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const pct = clickX / width;
                videoCurrentTime = pct * videoTotalTime;
                if (videoCurrentTime < 0) videoCurrentTime = 0;
                if (videoCurrentTime > videoTotalTime) videoCurrentTime = videoTotalTime;
                updateVideoState();
            });
        }
    }

    // Bio Ingredients Expandable Showcase (Pollop)
    const bioCards = document.querySelectorAll('.bio-ingredient-card');
    if (bioCards.length > 0) {
        bioCards.forEach(card => {
            card.addEventListener('click', () => {
                const isExpanded = card.classList.contains('expanded');
                bioCards.forEach(c => c.classList.remove('expanded'));
                if (!isExpanded) {
                    card.classList.add('expanded');
                }
            });
        });
    }

    // Hero Section Slideshow/Carousel
    const heroSlideshow = document.getElementById('hero-slideshow');
    if (heroSlideshow) {
        const slides = heroSlideshow.querySelectorAll('.hero-slide');
        const dots = heroSlideshow.querySelectorAll('.slide-dot');
        let currentSlide = 0;
        let slideInterval = null;

        function showSlide(index) {
            slides.forEach((slide, i) => {
                if (i === index) {
                    slide.classList.add('active');
                } else {
                    slide.classList.remove('active');
                }
            });

            dots.forEach((dot, i) => {
                if (i === index) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });

            currentSlide = index;
        }

        function nextSlide() {
            let next = (currentSlide + 1) % slides.length;
            showSlide(next);
        }

        function startAutoplay() {
            stopAutoplay();
            slideInterval = setInterval(nextSlide, 5000); // 5 seconds
        }

        function stopAutoplay() {
            if (slideInterval) {
                clearInterval(slideInterval);
            }
        }

        // Click on slideshow container to go to next image
        heroSlideshow.addEventListener('click', (e) => {
            // Check if user clicked a dot to prevent double trigger
            if (e.target.classList.contains('slide-dot')) return;
            nextSlide();
            startAutoplay(); // Reset autoplay timer
        });

        // Click on dots
        dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent container click event
                const index = parseInt(dot.getAttribute('data-slide'));
                showSlide(index);
                startAutoplay(); // Reset autoplay timer
            });
        });

        // Custom interactive cursor follower & 3D tilt
        const customCursor = document.getElementById('slideshow-cursor');
        if (customCursor) {
            heroSlideshow.addEventListener('mousemove', (e) => {
                const rect = heroSlideshow.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Position custom cursor
                customCursor.style.left = `${x}px`;
                customCursor.style.top = `${y}px`;
                
                // Calculate tilt angles based on mouse offset from center
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = -(y - centerY) / 12; // vertical tilt
                const rotateY = (x - centerX) / 12;  // horizontal tilt
                
                heroSlideshow.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
            });

            heroSlideshow.addEventListener('mouseleave', () => {
                // Reset transform smoothly
                heroSlideshow.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
            });
        }

        // Init autoplay
        startAutoplay();
    }
});
