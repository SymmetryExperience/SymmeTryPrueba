$(document).ready(function() {
    // Update scroll progress (función original mantenida)
    $(window).on('scroll', function() {
        let scrolled = $(window).scrollTop();
        let docHeight = $(document).height() - $(window).height();
        let progress = Math.round((scrolled / docHeight) * 100);
        $('.progress-bar').text(progress + '%');
    });

    // Scroll animations for revealing elements
    function checkScroll() {
        $('.section-content, .section-image, .service-item, .step-column').each(function() {
            let elementTop = $(this).offset().top;
            let viewportBottom = $(window).scrollTop() + $(window).height();

            if (elementTop < viewportBottom - 100) {
                $(this).addClass('visible');
            }
        });
    }

    $(window).on('scroll', checkScroll);
    checkScroll();

    // 3D card effect
    $('.card-3d').on('mousemove', function(e) {
        let rect = this.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        
        let centerX = rect.width / 2;
        let centerY = rect.height / 2;
        
        let rotateX = (y - centerY) / 10;
        let rotateY = (centerX - x) / 10;
        
        $(this).css('transform', `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`);
    });

    $('.card-3d').on('mouseleave', function() {
        $(this).css('transform', 'rotateX(0) rotateY(0)');
    });

    // Smooth scroll (funcionará con el nuevo menú)
    $('a[href^="#"]').on('click', function(e) {
        e.preventDefault();
        let target = $(this.getAttribute('href'));
        if (target.length) {
            $('html, body').stop().animate({
                scrollTop: target.offset().top - 80 // Adjusted for sticky header
            }, 1000);
        }
    });

    // LÓGICA ACTUALIZADA PARA LA NAVEGACIÓN DE TARJETAS EN INSIGHTS
    let currentPage = 0;
    const cardsPerPage = 3;
    const allCards = $('.insight-card-phone');
    const totalCards = allCards.length;
    const totalPages = Math.ceil(totalCards / cardsPerPage);
    const dotsContainer = $('.insights-navigation-dots');
    const prevButton = $('.card-nav-prev');
    const nextButton = $('.card-nav-next');

    function createDots() {
        dotsContainer.empty();
        for (let i = 0; i < totalPages; i++) {
            const dot = $('<span></span>').addClass('nav-dot').attr('data-page', i);
            if (i === 0) {
                dot.addClass('active-dot');
            }
            dotsContainer.append(dot);
        }
    }

    function updateDots() {
        $('.nav-dot').removeClass('active-dot');
        $(`.nav-dot[data-page="${currentPage}"]`).addClass('active-dot');
    }

    function showCardsPage(page, direction = 'next') {
        if ($(window).width() <= 968) {
            allCards.removeClass('card-hidden').show().css({
                'opacity': '1',
                'transform': 'translateX(0)',
                'animation': 'none'
            });
            return;
        }

        const startIndex = page * cardsPerPage;
        const endIndex = startIndex + cardsPerPage;
        const currentVisibleCards = allCards.filter(':not(.card-hidden)');
        
        if (currentVisibleCards.length > 0) {
            const exitClass = direction === 'next' ? 'card-sliding-out-left' : 'card-sliding-out-right';
            currentVisibleCards.addClass(exitClass);
        }

        setTimeout(() => {
            allCards.hide().addClass('card-hidden')
                .removeClass('card-sliding-out-left card-sliding-out-right card-sliding-in-left card-sliding-in-right')
                .css({'opacity': '1', 'transform': 'translateX(0)'});

            const cardsToShow = allCards.slice(startIndex, endIndex);
            cardsToShow.removeClass('card-hidden').show();

            const enterClass = direction === 'next' ? 'card-sliding-in-right' : 'card-sliding-in-left';
            cardsToShow.addClass(enterClass);

            updateDots();
        }, 300);
    }

    nextButton.on('click', function() {
        currentPage = (currentPage + 1) % totalPages;
        showCardsPage(currentPage, 'next');
        $(this).addClass('button-click');
        setTimeout(() => $(this).removeClass('button-click'), 200);
    });

    prevButton.on('click', function() {
        currentPage = (currentPage - 1 + totalPages) % totalPages;
        showCardsPage(currentPage, 'prev');
        $(this).addClass('button-click');
        setTimeout(() => $(this).removeClass('button-click'), 200);
    });

    dotsContainer.on('click', '.nav-dot', function() {
        const newPage = parseInt($(this).attr('data-page'));
        const direction = newPage > currentPage ? 'next' : 'prev';
        currentPage = newPage;
        showCardsPage(currentPage, direction);
    });

    function initializeCarousel() {
        const windowWidth = $(window).width();
        if (windowWidth > 968) {
            if (dotsContainer.is(':hidden')) dotsContainer.css('display', 'flex');
            if(totalPages > 1){
                createDots();
                prevButton.show();
                nextButton.show();
            } else {
                dotsContainer.hide();
                prevButton.hide();
                nextButton.hide();
            }
            showCardsPage(currentPage);
        } else {
            dotsContainer.hide();
            prevButton.hide();
            nextButton.hide();
            allCards.removeClass('card-hidden').show().each(function() {
                $(this).css({'opacity': '1', 'transform': 'translateX(0)', 'animation': 'none'});
            });
        }
    }

    initializeCarousel();
    $(window).on('resize', initializeCarousel);
});

// --- (El resto de tu JS original va aquí) ---
// ...

// ===== INICIO: SCRIPT PARA EL NUEVO MENÚ =====
const menuToggle = document.getElementById('menuToggle');
const fullscreenMenu = document.getElementById('fullscreenMenu');
const menuLinks = document.querySelectorAll('.menu-link');
const header = document.querySelector('header');

// Efecto blur al hacer scroll
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('active');
    fullscreenMenu.classList.toggle('active');
    document.body.style.overflow = fullscreenMenu.classList.contains('active') ? 'hidden' : '';
});



// Cerrar menú al hacer click en un link
menuLinks.forEach(link => {
    link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        fullscreenMenu.classList.remove('active');
        document.body.style.overflow = '';
    });
});

// Cerrar con tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fullscreenMenu.classList.contains('active')) {
        menuToggle.classList.remove('active');
        fullscreenMenu.classList.remove('active');
        document.body.style.overflow = '';
    }
});
// ===== FIN: SCRIPT PARA EL NUEVO MENÚ =====