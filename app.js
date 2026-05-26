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
    const SALON_PHONE = "393208821749";

    // -------------------------------------------------------------
    // Mock Bookings Initialization
    // -------------------------------------------------------------
    // Pre-populate some busy slots so the calendar looks realistic and active
    function initMockBookings() {
        if (!localStorage.getItem('beautydog_bookings')) {
            const mockBookings = [];
            // Generate mock bookings for the next 10 days
            for (let i = 0; i < 10; i++) {
                const date = new Date(CURRENT_YEAR, CURRENT_MONTH, CURRENT_DAY + i);
                const dateString = formatDateString(date);
                
                // Don't book on Sundays
                if (date.getDay() === 0) continue;

                // Pick 2-3 random slots to be busy
                const potentialSlots = ["09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00"];
                const shuffled = potentialSlots.sort(() => 0.5 - Math.random());
                const busyCount = Math.floor(Math.random() * 3) + 1; // 1 to 3 busy slots
                
                for (let j = 0; j < busyCount; j++) {
                    mockBookings.push({
                        date: dateString,
                        time: shuffled[j],
                        service: "Mock Booking",
                        petName: "Cucciolo"
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
                dayCell.addEventListener("click", () => {
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
                    renderTimeSlots(dateString);
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
    
    function renderTimeSlots(dateString) {
        timeSlotsGrid.innerHTML = "";
        
        // Define shop standard schedule
        // Standard hours: 9:00, 10:00, 11:00, 12:00, 15:00, 16:00, 17:00, 18:00
        const slots = ["09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00"];
        
        // Fetch current bookings from localStorage
        const bookings = getBookingsFromStorage();
        
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
    
    function getBookingsFromStorage() {
        const data = localStorage.getItem('beautydog_bookings');
        return data ? JSON.parse(data) : [];
    }
    
    function addBookingToStorage(bookingObj) {
        const bookings = getBookingsFromStorage();
        bookings.push(bookingObj);
        localStorage.setItem('beautydog_bookings', JSON.stringify(bookings));
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
        sumPet.textContent = `${petName} (${breed})`;
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
    whatsappConfirmBtn.addEventListener('click', () => {
        const ownerName = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const petName = document.getElementById('pet-name').value;
        const breed = document.getElementById('pet-breed').value;
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

🐶 *DETTAGLI CANE:*
- Nome: ${petName}
- Razza: ${breed}
- Taglia: ${sizeName}

✂️ *SERVIZIO RICHIESTO:*
- Trattamento: ${serviceName}${addonsText}
- Prezzo Stimato: €${total}

📅 *DATA E ORA RICHIESTE:*
- Giorno: ${dateFormatted}
- Orario: ${selectedTime}

👤 *CONTATTI PROPRIETARIO:*
- Nome: ${ownerName}
- Telefono: ${phone}
- Note: ${notes}

Attendo tua conferma dell'appuntamento! Grazie mille!`;

        // 2. Save appointment to local storage so the slot is permanently occupied
        const newBooking = {
            date: dateString,
            time: selectedTime,
            service: serviceName,
            petName: petName,
            clientName: ownerName,
            clientPhone: phone
        };
        addBookingToStorage(newBooking);

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
});
