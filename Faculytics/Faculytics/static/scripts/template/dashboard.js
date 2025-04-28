// campus.js
let analysisChartInstance = null;
let topicChartInstance = null;
let currentData = null;
let activeTab = "sentiment";
let globalCombinedComments = [];

document.addEventListener('DOMContentLoaded', function () {
    // Tab switching logic
    const sentimentTab = document.getElementById('dashboardSentimentTab');
    const topicTab = document.getElementById('dashboardTopicTab');
    const commentsTab = document.getElementById('dashboardCommentsTab');

    const sentimentContent = document.getElementById('dashboardSentimentContent');
    const topicContent = document.getElementById('dashboardTopicContent');
    const commentsContent = document.getElementById('dashboardCommentsContent');

    sentimentTab.addEventListener('click', function () {
        showTab('sentiment');
    });

    topicTab.addEventListener('click', function () {
        showTab('topic');
    });

    commentsTab.addEventListener('click', function () {
        showTab('comments');
    });

    function showTab(tab) {
        if (tab === 'sentiment') {
            sentimentContent.classList.remove('hidden');
            topicContent.classList.add('hidden');
            commentsContent.classList.add('hidden');
        } else if (tab === 'topic') {
            sentimentContent.classList.add('hidden');
            topicContent.classList.remove('hidden');
            commentsContent.classList.add('hidden');
        } else if (tab === 'comments') {
            sentimentContent.classList.addhtml('hidden');
            topicContent.classList.add('hidden');
            commentsContent.classList.remove('hidden');
        }
    }

    // Initialize by showing sentiment tab by default
    showTab('sentiment');
});


// Function to open the Dashboard Modal and load content
document.addEventListener('DOMContentLoaded', function () {
    // Now it's safe to call `document.getElementById`
    const modal = document.getElementById('dashboardAnalysisModal');
    if (modal) {

    // Show the modal (make it visible)
    const modal = document.getElementById('dashboardAnalysisModal');
    modal.classList.remove('hidden');

    // Fetch and update campus-specific data (sentiment, topics, comments)
        fetchCampusAnalytics(campusAcronym);
    }
});


// Function to fetch and update campus-specific analytics
function fetchCampusAnalytics(campusAcronym) {
    // Assuming you have a backend route for fetching campus analytics
    fetch(`/dashboard_analytics/${campusAcronym}`)
        .then(response => response.json())
        .then(data => {
            // Assuming 'data' contains sentiment, topics, comments, etc.

            // Example: Update Sentiment Chart
            updateSentimentChart(data.sentiment);

            // Example: Update Topic Modeling Chart
            updateTopicChart(data.topics);

            // Example: Update Comments List
            updateCommentsList(data.comments);
        })
        .catch(error => console.error('Error fetching analytics:', error));
}
// Function to update the Sentiment Chart (Chart.js)
function updateSentimentChart(sentimentData) {
    const ctx = document.getElementById('dashboardAnalysisChart').getContext('2d');
    new Chart(ctx, {
        type: 'line', // Example: Line chart for sentiment analysis
        data: {
            labels: sentimentData.labels,
            datasets: [{
                label: 'Sentiment Over Time',
                data: sentimentData.values,
                borderColor: '#00f6fa',
                fill: false
            }]
        }
    });
}

// Function to update the Topic Modeling Chart (Chart.js)
function updateTopicChart(topicData) {
    const ctx = document.getElementById('dashboardTopicChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar', // Example: Bar chart for topic distribution
        data: {
            labels: topicData.labels,
            datasets: [{
                label: 'Topic Distribution',
                data: topicData.values,
                backgroundColor: '#3b5999'
            }]
        }
    });
}

// Function to update the Comments List
function updateCommentsList(comments) {
    const commentsContainer = document.getElementById('dashboardCommentsList');
    commentsContainer.innerHTML = ''; // Clear existing comments

    comments.forEach(comment => {
        const commentElement = document.createElement('div');
        commentElement.classList.add('bg-gray-700', 'p-4', 'rounded-lg', 'mb-4');
        commentElement.innerHTML = `
            <p>${comment.text}</p>
            <p class="text-sm text-gray-400">Sentiment: ${comment.sentiment}</p>
        `;
        commentsContainer.appendChild(commentElement);
    });
}

// Function to close the modal
function closeDashboardAnalyticsModal() {
    const modal = document.getElementById('dashboardAnalysisModal');
    modal.classList.add('hidden');
}

function renderFilteredComments() {
    const commentsList = document.getElementById('commentsList');
    const topicFilterValue = document.getElementById('topicFilter').value.toLowerCase();
    const sentimentFilterValue = document.getElementById('sentimentFilter').value.toLowerCase();

    commentsList.innerHTML = "";

    let filtered = globalCombinedComments.filter(item => {
        const matchTopic = (topicFilterValue === "all" || (item.topic && item.topic.toLowerCase() === topicFilterValue));
        const matchSentiment = (sentimentFilterValue === "all" || (item.sentiment && item.sentiment.toLowerCase() === sentimentFilterValue));
        return matchTopic && matchSentiment;
    });

    if (filtered.length === 0) {
        commentsList.innerHTML = "<p class='text-white'>No comments found.</p>";
        return;
    }

    filtered.forEach(item => {
        const commentDiv = document.createElement('div');

        let bgColor = 'bg-white';
        if (item.sentiment && item.sentiment.toLowerCase() === 'positive') {
            bgColor = 'bg-green-200';
        } else if (item.sentiment && item.sentiment.toLowerCase() === 'negative') {
            bgColor = 'bg-red-200';
        }

        commentDiv.classList.add('mb-2', 'p-2', 'rounded', 'shadow-sm', 'text-black', bgColor);

        commentDiv.innerHTML = `
            <p><strong>Comment:</strong> ${item.text}</p>
            <p><strong>Topic:</strong> ${item.topic}</p>
            <p><strong>Sentiment:</strong> ${item.sentiment}</p>
        `;

        commentsList.appendChild(commentDiv);
    });
}

function setupTabSwitching() {
    document.getElementById('sentimentTab').addEventListener('click', () => switchTab('sentiment'));
    document.getElementById('topicTab').addEventListener('click', () => switchTab('topic'));
    document.getElementById('commentsTab').addEventListener('click', () => switchTab('comments'));
}

function switchTab(tab) {
    document.getElementById('sentimentContent').classList.add('hidden');
    document.getElementById('topicContent').classList.add('hidden');
    document.getElementById('commentsContent').classList.add('hidden');

    document.getElementById('sentimentTab').classList.remove('bg-blue-600');
    document.getElementById('topicTab').classList.remove('bg-blue-600');
    document.getElementById('commentsTab').classList.remove('bg-blue-600');

    if (tab === 'sentiment') {
        document.getElementById('sentimentContent').classList.remove('hidden');
        document.getElementById('sentimentTab').classList.add('bg-blue-600');
    } else if (tab === 'topic') {
        document.getElementById('topicContent').classList.remove('hidden');
        document.getElementById('topicTab').classList.add('bg-blue-600');
    } else if (tab === 'comments') {
        document.getElementById('commentsContent').classList.remove('hidden');
        document.getElementById('commentsTab').classList.add('bg-blue-600');
    }

    activeTab = tab;
    loadChart(currentData);
}

function loadChart(data) {
    if (!data) return;
    if (activeTab === "sentiment") {
        setupSentimentChart(data.sentimentData);
    } else if (activeTab === "topic") {
        setupTopicChart(data.topicData);
    } else if (activeTab === "comments") {
        setupComments(data.commentsData);
    }
}
