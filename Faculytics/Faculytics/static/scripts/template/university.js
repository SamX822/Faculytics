// university.js
let globalDashboardDataUniversity = {};
let analysisChartInstanceUniversity = null;
let topicChartInstanceUniversity = null;
let needsAnalysisChartInstanceUniversity = null;
let currentDataUniversity = null;
let activeTabUniversity = "sentiment";
let globalCombinedCommentsUniversity = [];

document.addEventListener('DOMContentLoaded', () => {
    // Initialize event listeners for filters
    const topicFilterElement = document.getElementById('universityTopicFilter');
    const sentimentFilterElement = document.getElementById('universitySentimentFilter');

    if (topicFilterElement) {
        topicFilterElement.addEventListener('change', renderFilteredCommentsUniversity);
    }
    if (sentimentFilterElement) {
        sentimentFilterElement.addEventListener('change', renderFilteredCommentsUniversity);
    }

    const tabs = {
        sentimentTab: {
            button: document.getElementById('universitySentimentTab'),
            content: document.getElementById('universitySentimentContent')
        },
        topicTab: {
            button: document.getElementById('universityTopicTab'),
            content: document.getElementById('universityTopicContent')
        },
        needsAnalysisTab: {
            button: document.getElementById('universityNeedsAnalysisTab'),
            content: document.getElementById('universityNeedsAnalysisContent')
        },
        commentsTab: {
            button: document.getElementById('universityCommentsTab'),
            content: document.getElementById('universityCommentsContent'),
            filters: document.getElementById('universityCommentFilters')
        }
    };

    // Initialize tabs
    Object.values(tabs).forEach(({ button, content, filters }) => {
        // Only add listener if the button exists
        if (button) {
            button.addEventListener('click', () => {
                Object.values(tabs).forEach(tab => {
                    if (tab.button) { // Check if tab button exists before manipulating
                        tab.button.classList.remove('bg-blue-600', 'text-white');
                        tab.button.classList.add('bg-gray-700', 'text-gray-300');
                    }
                    if (tab.content) { // Check if tab content exists before manipulating
                        tab.content.classList.add('hidden');
                    }
                    if (tab.filters) { // Check if tab filters exist before manipulating
                        tab.filters.classList.add('hidden');
                    }
                });

                // Check if button exists before manipulating
                if (button) {
                    button.classList.add('bg-blue-600', 'text-white');
                    button.classList.remove('bg-gray-700', 'text-gray-300');
                }
                // Check if content exists before manipulating
                if (content) {
                    content.classList.remove('hidden');
                }
                // Check if filters exist before manipulating
                if (filters) {
                    filters.classList.remove('hidden');
                }

                activeTabUniversity = button.id.replace('universityTab', '').toLowerCase();

                fetchAndUpdateChartUniversity();
            });
        }
    });

    // Automatically click the sentiment tab on load, but only if it exists
    if (tabs.sentimentTab.button) {
        tabs.sentimentTab.button.click();
    }
});


function renderFilteredCommentsUniversity() {
    const commentsList = document.getElementById('universityCommentsList');
    const topicFilterElement = document.getElementById('universityTopicFilter');
    const sentimentFilterElement = document.getElementById('universitySentimentFilter');

    if (!commentsList || !topicFilterElement || !sentimentFilterElement) {
        console.error("Missing comment list or filter elements in renderFilteredCommentsUniversity.");
        return;
    }

    const topicFilterValue = topicFilterElement.value.toLowerCase();
    const sentimentFilterValue = sentimentFilterElement.value.toLowerCase();

    commentsList.innerHTML = "";

    let filtered = globalCombinedCommentsUniversity.filter(item => {
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

function fetchAndUpdateChartUniversity() {
    fetch(`/dashboard_analytics_all_campuses`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => {
            console.log("Received University-wide Data:", data);
            currentDataUniversity = data;
            loadChartUniversity(data);
        })
        .catch(err => console.error("Error fetching university-wide data:", err));
}

document.addEventListener('DOMContentLoaded', () => {
    const sentimentTab = document.getElementById('universitySentimentTab');
    const topicTab = document.getElementById('universityTopicTab');
    const needsAnalysisTab = document.getElementById('universityNeedsAnalysisTab');
    const commentsTab = document.getElementById('universityCommentsTab');

    if (sentimentTab) {
        sentimentTab.addEventListener('click', () => switchTabUniversity('sentiment'));
    }
    if (topicTab) {
        topicTab.addEventListener('click', () => switchTabUniversity('topic'));
    }
    if (needsAnalysisTab) {
        needsAnalysisTab.addEventListener('click', () => switchTabUniversity('needsanalysis'));
    }
    if (commentsTab) {
        commentsTab.addEventListener('click', () => switchTabUniversity('comments'));
    }
});


function switchTabUniversity(tab) {
    // Get all tab content sections and filter container
    const sentimentContent = document.getElementById('universitySentimentContent');
    const topicContent = document.getElementById('universityTopicContent');
    const needsAnalysisContent = document.getElementById('universityNeedsAnalysisContent');
    const commentsContent = document.getElementById('universityCommentsContent');
    const commentFilters = document.getElementById('universityCommentFilters');

    // Get all tab buttons
    const sentimentTabBtn = document.getElementById('universitySentimentTab');
    const topicTabBtn = document.getElementById('universityTopicTab');
    const needsAnalysisTabBtn = document.getElementById('universityNeedsAnalysisTab');
    const commentsTabBtn = document.getElementById('universityCommentsTab');

    // Hide all content sections and filters, and reset button styles
    if (sentimentContent) sentimentContent.classList.add('hidden');
    if (topicContent) topicContent.classList.add('hidden');
    if (needsAnalysisContent) needsAnalysisContent.classList.add('hidden');
    if (commentsContent) commentsContent.classList.add('hidden');
    if (commentFilters) commentFilters.classList.add('hidden');

    if (sentimentTabBtn) sentimentTabBtn.classList.remove('bg-blue-600');
    if (topicTabBtn) topicTabBtn.classList.remove('bg-blue-600');
    if (needsAnalysisTabBtn) needsAnalysisTabBtn.classList.remove('bg-blue-600');
    if (commentsTabBtn) commentsTabBtn.classList.remove('bg-blue-600');

    // Show selected tab content and highlight the selected tab
    if (tab === 'sentiment') {
        if (sentimentContent) sentimentContent.classList.remove('hidden');
        if (sentimentTabBtn) sentimentTabBtn.classList.add('bg-blue-600');
        activeTabUniversity = 'sentiment';
    } else if (tab === 'topic') {
        if (topicContent) topicContent.classList.remove('hidden');
        if (topicTabBtn) topicTabBtn.classList.add('bg-blue-600');
        activeTabUniversity = 'topic';
    } else if (tab === 'needsanalysis') {
        if (needsAnalysisContent) needsAnalysisContent.classList.remove('hidden');
        if (needsAnalysisTabBtn) needsAnalysisTabBtn.classList.add('bg-blue-600');
        activeTabUniversity = 'needsanalysis';
    } else if (tab === 'comments') {
        if (commentsContent) commentsContent.classList.remove('hidden');
        if (commentsTabBtn) commentsTabBtn.classList.add('bg-blue-600');
        if (commentFilters) commentFilters.classList.remove('hidden');
        activeTabUniversity = 'comments';
    }

    fetchAndUpdateChartUniversity();
}


function openUniversityAnalyticsModal() {
    const modal = document.getElementById("universityAnalysisModal");
    if (modal) {
        modal.classList.remove("hidden");
    } else {
        console.error("University Analysis Modal not found!");
        return;
    }

    const sentimentTabButton = document.getElementById('universitySentimentTab');
    if (sentimentTabButton) {
        sentimentTabButton.click();
    } else {
        console.error("University Sentiment Tab button not found!");
    }
}


function closeUniversityAnalyticsModal() {
    const modal = document.getElementById('universityAnalysisModal');
    if (modal) {
        modal.classList.add('hidden');
    } else {
        console.error("University Analysis Modal not found when trying to close.");
    }

    // Destroy chart instances to prevent rendering issues on subsequent opens
    if (analysisChartInstanceUniversity) {
        analysisChartInstanceUniversity.destroy();
        analysisChartInstanceUniversity = null;
    }
    if (topicChartInstanceUniversity) {
        topicChartInstanceUniversity.destroy();
        topicChartInstanceUniversity = null;
    }
    if (needsAnalysisChartInstanceUniversity) {
        needsAnalysisChartInstanceUniversity.destroy();
        needsAnalysisChartInstanceUniversity = null;
    }
}


function loadChartUniversity(data) {
    if (activeTabUniversity === "sentiment") {
        loadSentimentChartUniversity(data);
    } else if (activeTabUniversity === "topic") {
        loadTopicChartUniversity(data);
    } else if (activeTabUniversity === "needsanalysis") {
        loadNeedsAnalysisChartUniversity(data);
    } else if (activeTabUniversity === "comments") {
        loadCommentsUniversity(data);
    }
}

function loadSentimentChartUniversity(data) {
    if (analysisChartInstanceUniversity) analysisChartInstanceUniversity.destroy();
    const ctx = document.getElementById('universityAnalysisChart').getContext('2d');

    function parseFilename(filename) {
        // Ensure filename is a string before splitting
        if (typeof filename !== 'string') {
            console.warn("Invalid filename for parsing:", filename);
            return { startYear: 0, endYear: 0, semester: 0 };
        }
        const parts = filename.split('_').map(Number);
        // Ensure parts has at least 3 elements
        if (parts.length < 3) {
            console.warn("Filename does not contain expected parts:", filename);
            return { startYear: 0, endYear: 0, semester: 0 };
        }
        return {
            startYear: parts[0],
            endYear: parts[1],
            semester: parts[2]
        };
    }
    function formatLabel(parsedFilename) {
        const semesterString = parsedFilename.semester === 1 ? '1st Sem' : '2nd Sem';
        return `A.Y. ${parsedFilename.startYear}-${parsedFilename.endYear} ${semesterString}`;
    }

    // group by filename
    const buckets = {};
    // Ensure data.sentiment is an array before iterating
    if (data && Array.isArray(data.sentiment)) {
        data.sentiment.forEach(({ filename, sentiment_score }) => {
            // Initialize the bucket for the filename if it doesn't exist
            if (!buckets[filename]) {
                buckets[filename] = { positive: 0, negative: 0 };
            }

            // Safely increment positive or negative count
            if (sentiment_score === "Positive") { 
                buckets[filename].positive++;
            } else if (sentiment_score === "Negative") {
                buckets[filename].negative++;
            }
        });
    }


    // Sort filenames chronologically and format labels
    const sortedFilenames = Object.keys(buckets).sort((a, b) => {
        const aParts = parseFilename(a);
        const bParts = parseFilename(b);

        if (aParts.startYear !== bParts.startYear) {
            return aParts.startYear - bParts.startYear;
        } else if (aParts.endYear !== bParts.endYear) {
            return aParts.endYear - bParts.endYear;
        } else {
            return aParts.semester - bParts.semester;
        }
    });

    // sort filenames chronologically
    const labels = sortedFilenames.map(filename => formatLabel(parseFilename(filename)));
    const positiveData = sortedFilenames.map(f => buckets[f].positive);
    const negativeData = sortedFilenames.map(f => buckets[f].negative);

    console.log("University Sentiment Buckets:", buckets);
    console.log("University Positive Data:", positiveData);
    console.log("University Negative Data:", negativeData);
    console.log("University Formatted Labels:", labels);

    analysisChartInstanceUniversity = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Positive',
                    data: positiveData,
                    borderColor: 'green',
                    fill: false,
                    pointStyle: 'circle',
                    pointRadius: 5
                },
                {
                    label: 'Negative',
                    data: negativeData,
                    borderColor: 'red',
                    fill: false,
                    pointStyle: 'circle',
                    pointRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Sentiment Count',
                        color: 'white'
                    },
                    ticks: {
                        stepSize: 1,
                        color: 'white'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Academic Year - Semester',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: 'white'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (tooltipItem) {
                            return `${tooltipItem.dataset.label}: ${tooltipItem.raw} sentiments`;
                        }
                    }
                }
            }
        }
    });
}

function loadTopicChartUniversity(data) {
    if (topicChartInstanceUniversity) topicChartInstanceUniversity.destroy();
    const ctx = document.getElementById('universityTopicChart').getContext('2d');

    console.log('University Topics data:', data.topics);

    // count & split sentiments
    const tCounts = {}, tSents = {};
    // Ensure data.topics is an array before iterating
    if (data && Array.isArray(data.topics)) {
        data.topics.forEach(({ topic, sentiment }) => {
            if (!topic || !sentiment) return;
            if (!tCounts[topic]) {
                tCounts[topic] = 0;
                tSents[topic] = { positive: 0, negative: 0 };
            }
            tCounts[topic]++;
            tSents[topic][sentiment.toLowerCase()]++;
        });
    }


    console.log('University Topic Counts:', tCounts);
    console.log('University Topic Sentiments:', tSents);

    const topTopics = Object.keys(tCounts)
        .sort((a, b) => tCounts[b] - tCounts[a])
        .slice(0, 10);
    const pos = topTopics.map(t => tSents[t].positive);
    const neg = topTopics.map(t => tSents[t].negative);

    topicChartInstanceUniversity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topTopics,
            datasets: [{
                label: 'Positive',
                data: pos,
                backgroundColor: 'rgba(40, 167, 69, 0.7)',
                borderColor: 'rgba(40, 167, 69, 1)',
                borderWidth: 1,
                categoryPercentage: 0.8,
                barPercentage: 0.4
            }, {
                label: 'Negative',
                data: neg,
                backgroundColor: 'rgba(220, 53, 69, 0.7)',
                borderColor: 'rgba(220, 53, 69, 1)',
                borderWidth: 1,
                categoryPercentage: 0.8,
                barPercentage: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count',
                        color: 'white'
                    },
                    ticks: {
                        stepSize: 1,
                        color: 'white'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Category',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: 'white'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (tooltipItem) {
                            return `${tooltipItem.dataset.label}: ${tooltipItem.raw} instances`;
                        }
                    }
                }
            }
        }
    });
}

function loadNeedsAnalysisChartUniversity(data) {
    if (needsAnalysisChartInstanceUniversity) {
        needsAnalysisChartInstanceUniversity.destroy();
    }
    const ctx = document.getElementById('universityNeedsAnalysisChart').getContext('2d');

    let negativeTopicCounts = {};

    if (data && Array.isArray(data.topics)) { // Ensure data.topics is an array
        data.topics.forEach(({ topic, sentiment }) => {
            if (topic && topic.trim() !== "" && sentiment && sentiment.toLowerCase() === "negative") {
                negativeTopicCounts[topic] = (negativeTopicCounts[topic] || 0) + 1;
            }
        });
    }


    const sortedTopics = Object.keys(negativeTopicCounts)
        .sort((a, b) => negativeTopicCounts[b] - negativeTopicCounts[a])
        .slice(0, 10);

    const topicLabels = sortedTopics.map(topic => topic);
    const topicData = sortedTopics.map(topic => negativeTopicCounts[topic]);

    needsAnalysisChartInstanceUniversity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topicLabels,
            datasets: [{
                label: 'Negative Feedback',
                data: topicData,
                backgroundColor: 'rgba(220, 53, 69, 0.7)',
                borderColor: 'rgba(220, 53, 69, 1)',
                borderWidth: 1,
                categoryPercentage: 0.8,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Negative Feedback',
                        color: 'white'
                    },
                    ticks: {
                        stepSize: 1,
                        color: 'white'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Category',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        label: function (tooltipItem) {
                            return `Negative Feedback: ${tooltipItem.raw}`;
                        }
                    }
                }
            }
        }
    });
}

function loadCommentsUniversity(data) {
    const commentsList = document.getElementById('universityCommentsList');
    const topicFilter = document.getElementById('universityTopicFilter');
    const sentimentFilter = document.getElementById('universitySentimentFilter');

    // Ensure all elements exist before proceeding
    if (!commentsList || !topicFilter || !sentimentFilter) {
        console.error("Missing comments list or filter elements in loadCommentsUniversity.");
        return;
    }

    commentsList.innerHTML = '';
    topicFilter.innerHTML = '<option value="all">All Topics</option>';
    sentimentFilter.innerHTML = '<option value="all">All Sentiments</option>';

    // Ensure data.comments is an array before assigning
    globalCombinedCommentsUniversity = Array.isArray(data.comments) ? data.comments : [];

    // populate filters
    [...new Set(globalCombinedCommentsUniversity.map(c => c.topic))]
        .forEach(topic => {
            if (topic) { // Ensure topic is not null or undefined
                const opt = document.createElement('option');
                opt.value = opt.textContent = topic;
                topicFilter.appendChild(opt);
            }
        });
    [...new Set(globalCombinedCommentsUniversity.map(c => c.sentiment))]
        .forEach(sent => {
            if (sent) { // Ensure sentiment is not null or undefined
                const opt = document.createElement('option');
                opt.value = opt.textContent = sent;
                sentimentFilter.appendChild(opt);
            }
        });

    renderFilteredCommentsUniversity();
}