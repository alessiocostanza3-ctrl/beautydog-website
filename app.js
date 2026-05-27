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
        
        slots.forEach(slot => {
            const slotBtn = document.createElement("button");
            slotBtn.type = "button";
            slotBtn.className = "time-slot-btn";
            slotBtn.textContent = slot;
            
            // Check if slot is occupied
            const isOccupied = bookings.some(b => b.date === dateString && b.time === slot);
            
            // Also, disable slots in the past if the selected date is TODAY
            const isToday = dateString === formatDateString(TODAY_DATE);
            let isPastHour = false;
            
            if (isToday) {
                // Local current simulated time can be extracted, but since it's 22:02 in the metadata,
                // if they choose May 25th, actually all hours are past. But let's assume we can book if slot is later.
                // To keep the demo working smoothly, we check the actual hour.
                const currentHour = 22; // 22:02 from local time metadata
                const slotHour = parseInt(slot.split(":")[0]);
                if (slotHour <= currentHour) {
                    isPastHour = true;
                }
            }

            if (isOccupied || isPastHour) {
                slotBtn.classList.add("disabled");
                slotBtn.disabled = true;
                if (isOccupied) {
                    slotBtn.title = "Orario già prenotato";
                } else {
                    slotBtn.title = "Orario passato";
                }
            } else {
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
            
            timeSlotsGrid.appendChild(slotBtn);
        });
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
        
        return base + addonsTotal + sizeAddon;
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
- Trattamento: ${serviceName}${addonsText}
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
            price: total
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
        if (typing) typing.remove();
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
        addBotMessage("Ciao! \u{1F436} Io sono <strong>Buddy</strong>, l'assistente virtuale di BeautyDog. Ti aiuterò a richiedere un appuntamento in pochi secondi!");
        setTimeout(() => {
            askClientName();
        }, 1000);
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
        addBotMessage(`Che bel nome! E di che razza è ${buddyData.petName}? (Scrivi pure Meticcio se è un incrocio)`);
        renderTextPrompt("Razza del cane...", "text", (val) => {
            buddyData.petBreed = val;
            askPetAge();
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
            { label: "Altro", value: "Altro" }
        ], (val, label) => {
            buddyData.zone = val;
            askPhone();
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
});
