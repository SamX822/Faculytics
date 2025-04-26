document.addEventListener('DOMContentLoaded', () => {
    // ----- Analysis Modal Logic -----
    const analysisModal = document.getElementById('analysisModal');
    const sentimentTab = document.getElementById('sentimentTab');
    const topicTab = document.getElementById('topicTab');
    const commentsTab = document.getElementById('commentsTab');
    const sentimentContent = document.getElementById('sentimentContent');
    const topicContent = document.getElementById('topicContent');
    const commentsContent = document.getElementById('commentsContent');
    const viewButton = document.getElementById('viewButton');
    const fileSelect = document.getElementById('fileSelect');

    // Open/Close functions
    window.openAnalysisModal = function (itemId) {
        // Use itemId to fetch and render specific data
        analysisModal.classList.remove('hidden');
        // TODO: fetch sentiment, topics, and comments for itemId
    };

    window.closeAnalysisModal = function () {
        analysisModal.classList.add('hidden');
    };

    // Tab switch helper
    function switchTab(active) {
        // Reset button styles to inactive
        [sentimentTab, topicTab, commentsTab].forEach(btn => {
            btn.classList.replace('bg-blue-600', 'bg-gray-700');
        });
        // Hide all content sections
        [sentimentContent, topicContent, commentsContent].forEach(el => {
            el.classList.add('hidden');
        });
        // Activate selected tab and content
        if (active === 'sentiment') {
            sentimentTab.classList.replace('bg-gray-700', 'bg-blue-600');
            sentimentContent.classList.remove('hidden');
        } else if (active === 'topic') {
            topicTab.classList.replace('bg-gray-700', 'bg-blue-600');
            topicContent.classList.remove('hidden');
        } else if (active === 'comments') {
            commentsTab.classList.replace('bg-gray-700', 'bg-blue-600');
            commentsContent.classList.remove('hidden');
        }
    }

    // Wire up tab clicks if elements exist
    if (sentimentTab && topicTab && commentsTab) {
        sentimentTab.addEventListener('click', () => switchTab('sentiment'));
        topicTab.addEventListener('click', () => switchTab('topic'));
        commentsTab.addEventListener('click', () => switchTab('comments'));
    }

    // Handle View button click for file selection
    if (viewButton && fileSelect) {
        viewButton.addEventListener('click', () => {
            const selectedFile = fileSelect.value;
            // TODO: fetch and display data in #fileDetails based on selectedFile
        });
    }
});
