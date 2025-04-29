/**
 * NotificationSystem - A modular notification system for displaying temporary notifications
 * 
 * Usage:
 * 1. Import the script
 * 2. Initialize: const notifier = new NotificationSystem();
 * 3. Show notification: notifier.showNotification({
 *      type: 'success',
 *      title: 'Success!',
 *      message: 'Your action was completed successfully.',
 *      duration: 3000
 *    });
 */

class NotificationSystem {
    constructor(options = {}) {
        // Default configuration
        this.config = {
            position: options.position || 'top-right',
            zIndex: options.zIndex || 9999,
            defaultDuration: options.defaultDuration || 3000,
            maxNotifications: options.maxNotifications || 5,
            animations: options.animations !== false
        };

        // Create container if it doesn't exist
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.setupContainerStyles();
            document.body.appendChild(this.container);
        }

        // Track active notifications
        this.activeNotifications = [];
    }

    setupContainerStyles() {
        const positions = {
            'top-right': 'top: 1rem; right: 1rem; align-items: flex-end;',
            'top-left': 'top: 1rem; left: 1rem; align-items: flex-start;',
            'bottom-right': 'bottom: 1rem; right: 1rem; align-items: flex-end;',
            'bottom-left': 'bottom: 1rem; left: 1rem; align-items: flex-start;',
            'top-center': 'top: 1rem; left: 50%; transform: translateX(-50%); align-items: center;',
            'bottom-center': 'bottom: 1rem; left: 50%; transform: translateX(-50%); align-items: center;'
        };

        this.container.style.cssText = `
      position: fixed;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
      z-index: ${this.config.zIndex};
      ${positions[this.config.position] || positions['top-right']}
    `;
    }

    /**
     * Show a notification
     * @param {Object} options - Notification options
     * @param {string} options.type - Type of notification ('success', 'error', 'warning', 'info')
     * @param {string} options.title - Title of the notification
     * @param {string} options.message - Message content
     * @param {number} options.duration - Duration in ms (defaults to config.defaultDuration)
     * @param {Function} options.onClose - Optional callback on notification close
     * @returns {Object} The notification object with control methods
     */
    showNotification(options) {
        // Check if max notifications reached
        if (this.activeNotifications.length >= this.config.maxNotifications) {
            // Remove the oldest notification
            this.activeNotifications[0].close();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${options.type || 'info'}`;
        notification.style.cssText = `
      pointer-events: auto;
      max-width: 24rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      transform: translateX(${this.config.position.includes('right') ? '100%' :
                this.config.position.includes('left') ? '-100%' : '0'});
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
    `;

        // Set background color based on type
        const colors = {
            'success': 'bg-green-50 border-l-4 border-green-500',
            'error': 'bg-red-50 border-l-4 border-red-500',
            'warning': 'bg-yellow-50 border-l-4 border-yellow-500',
            'info': 'bg-blue-50 border-l-4 border-blue-500'
        };

        notification.classList.add(...(colors[options.type || 'info'].split(' ')));

        // Create content
        const duration = options.duration || this.config.defaultDuration;
        notification.innerHTML = this.getNotificationTemplate(options);

        // Start timer bar animation
        const timerBar = notification.querySelector('.timer-bar');
        if (timerBar) {
            timerBar.style.transition = `width ${duration}ms linear`;
        }

        // Add to container
        this.container.appendChild(notification);

        // Create notification object
        const notificationObj = {
            element: notification,
            close: () => this.closeNotification(notification, options.onClose)
        };

        // Add to active notifications
        this.activeNotifications.push(notificationObj);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
            if (timerBar) {
                timerBar.style.width = '0%';
            }
        }, 10);

        // Auto close after duration
        if (duration !== 0) {
            setTimeout(() => {
                this.closeNotification(notification, options.onClose);
            }, duration);
        }

        return notificationObj;
    }

    /**
     * Close a notification
     * @param {HTMLElement} notification - The notification element
     * @param {Function} callback - Optional callback on close
     */
    closeNotification(notification, callback) {
        if (!notification || !notification.parentNode) return;

        notification.style.opacity = '0';
        notification.style.transform = `translateX(${this.config.position.includes('right') ? '100%' :
            this.config.position.includes('left') ? '-100%' : '0'})`;

        // Remove from active notifications
        this.activeNotifications = this.activeNotifications.filter(item => item.element !== notification);

        // Remove from DOM after animation
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            if (typeof callback === 'function') {
                callback();
            }
        }, 300);
    }

    /**
     * Generate notification template based on type
     */
    getNotificationTemplate(options) {
        const icons = {
            'success': `<svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                    <!-- Base circle with gradient -->
                    <defs>
                      <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#34d399" />
                        <stop offset="100%" stop-color="#10b981" />
                      </linearGradient>
                    </defs>
                    
                    <!-- Circle background -->
                    <circle cx="12" cy="12" r="11" fill="white" stroke="url(#successGradient)" stroke-width="1.5" />
                    
                    <!-- Check mark -->
                    <path d="M7 13l3 3 7-7" 
                          stroke="url(#successGradient)" 
                          stroke-width="2.5" 
                          stroke-linecap="round" 
                          stroke-linejoin="round" 
                          fill="none" />
                  </svg>`,
            'error': `<svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>`,
            'warning': `<svg class="h-6 w-6 text-yellow-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>`,
            'info': `<svg class="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>`
        };

        const icon = options.icon || icons[options.type || 'info'];
        const titleColorClass = `text-${options.type || 'info'}-800`;
        const messageColorClass = `text-${options.type || 'info'}-700`;

        return `
      <div class="p-4 relative">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            ${icon}
          </div>
          <div class="ml-3 flex-1">
            <h3 class="text-sm font-medium ${titleColorClass}">${options.title || ''}</h3>
            <div class="mt-1 text-sm ${messageColorClass}">
              <p>${options.message || ''}</p>
            </div>
          </div>
        </div>
        <!-- Progress bar timer -->
        <div class="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden">
          <div class="timer-bar h-1.5 rounded-full" style="width: 100%; background-color: ${options.type === 'success' ? '#10B981' :
                options.type === 'error' ? '#EF4444' :
                    options.type === 'warning' ? '#F59E0B' :
                        '#3B82F6'
            }"></div>
        </div>
      </div>
    `;
    }

    /**
     * Convenience method for success notifications
     */
    success(title, message, options = {}) {
        return this.showNotification({
            type: 'success',
            title,
            message,
            ...options
        });
    }

    /**
     * Convenience method for error notifications
     */
    error(title, message, options = {}) {
        return this.showNotification({
            type: 'error',
            title,
            message,
            ...options
        });
    }

    /**
     * Convenience method for warning notifications
     */
    warning(title, message, options = {}) {
        return this.showNotification({
            type: 'warning',
            title,
            message,
            ...options
        });
    }

    /**
     * Convenience method for info notifications
     */
    info(title, message, options = {}) {
        return this.showNotification({
            type: 'info',
            title,
            message,
            ...options
        });
    }

    /**
     * Specific method for registration notifications
     */
    registrationSuccess(firstName, lastName, options = {}) {
        return this.success(
            "Registration Submitted",
            `The account for <span class="font-semibold">${lastName}, ${firstName}</span> has been submitted for approval.`,
            options
        );
    }
}

// Add event listener for close buttons
document.addEventListener('click', function (event) {
    if (event.target.closest('.close-btn')) {
        const notification = event.target.closest('.notification');
        if (notification) {
            // Find the notification instance
            const container = document.getElementById('notification-container');
            if (container) {
                // Hide notification
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';

                // Remove after animation completes
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }
    }
});

// Create a global instance if needed
if (typeof window !== 'undefined' && !window.notifier) {
    window.notifier = new NotificationSystem();
}