// campus.js
let analysisChartInstance = null;
let topicChartInstance = null;
let needsAnalysisChartInstance = null;
let currentData = null;
let activeTab = "sentiment";
let globalCombinedComments = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('topicFilter').addEventListener('change', renderFilteredComments);
    document.getElementById('sentimentFilter').addEventListener('change', renderFilteredComments);

    const tabs = {
        sentimentTab: {
            button: document.getElementById('sentimentTab'),
            content: document.getElementById('sentimentContent')
        },
        topicTab: {
            button: document.getElementById('topicTab'),
            content: document.getElementById('topicContent')
        },
        needsAnalysisTab: {
            button: document.getElementById('needsAnalysisTab'),
            content: document.getElementById('needsAnalysisContent')
        },
        commentsTab: {
            button: document.getElementById('commentsTab'),
            content: document.getElementById('commentsContent'),
            filters: document.getElementById('commentFilters')
        }
    };

    // Initialize tabs
    Object.values(tabs).forEach(({ button, content, filters }) => {
        button.addEventListener('click', () => {
            Object.values(tabs).forEach(tab => {
                tab.button.classList.remove('bg-blue-600', 'text-white');
                tab.button.classList.add('bg-gray-700', 'text-gray-300');
                tab.content.classList.add('hidden');
                if (tab.filters) tab.filters.classList.add('hidden');
            });

            button.classList.add('bg-blue-600', 'text-white');
            button.classList.remove('bg-gray-700', 'text-gray-300');
            content.classList.remove('hidden');
            if (filters) filters.classList.remove('hidden');

            activeTab = button.id.replace('Tab', '').toLowerCase();

            fetchAndUpdateChart();
        });
    });

    tabs.sentimentTab.button.click();
});

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

function fetchAndUpdateChart() {
    const campusAcronym = document.getElementById('campusAcronymInput').value;
    const collegeAcronym = document.getElementById('collegeAcronymInput').value;

    if (!campusAcronym || !collegeAcronym) {
        console.error("Missing campus or college acronym");
        return;
    }

    fetch(`/campus_analytics?campus_acronym=${campusAcronym}&college_acronym=${collegeAcronym}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => {
            console.log("Received Data:", data);
            currentData = data;
            loadChart(data);
        })
        .catch(err => console.error("Error fetching data:", err));
}

document.getElementById('sentimentTab').addEventListener('click', () => switchTab('sentiment'));
document.getElementById('topicTab').addEventListener('click', () => switchTab('topic'));
document.getElementById('needsAnalysisTab').addEventListener('click', () => switchTab('needsanalysis'));
document.getElementById('commentsTab').addEventListener('click', () => switchTab('comments'));

function switchTab(tab) {
    // Hide all content sections
    document.getElementById('sentimentContent').classList.add('hidden');
    document.getElementById('topicContent').classList.add('hidden');
    document.getElementById('needsAnalysisContent').classList.add('hidden');
    document.getElementById('commentsContent').classList.add('hidden');

    // Reset tab button styles
    document.getElementById('sentimentTab').classList.remove('bg-blue-600');
    document.getElementById('topicTab').classList.remove('bg-blue-600');
    document.getElementById('needsAnalysisTab').classList.remove('bg-blue-600');
    document.getElementById('commentsTab').classList.remove('bg-blue-600');

    // Show selected tab content and highlight the selected tab
    if (tab === 'sentiment') {
        document.getElementById('sentimentContent').classList.remove('hidden');
        document.getElementById('sentimentTab').classList.add('bg-blue-600');
    } else if (tab === 'topic') {
        document.getElementById('topicContent').classList.remove('hidden');
        document.getElementById('topicTab').classList.add('bg-blue-600');
    } else if (tab === 'needsanalysis') {
        document.getElementById('needsAnalysisContent').classList.remove('hidden');
        document.getElementById('needsAnalysisTab').classList.add('bg-blue-600');
        activeTab = 'needsanalysis';
    } else if (tab === 'comments') {
        document.getElementById('commentsContent').classList.remove('hidden');
        document.getElementById('commentsTab').classList.add('bg-blue-600');
    }
}

function openCampusAnalyticsModal(event, campusAcronym, collegeAcronym) {
    // Prevent any default behavior from the button click
    event.preventDefault();

    // Set the campus acronym and college acronym
    document.getElementById('campusAcronymInput').value = campusAcronym;
    document.getElementById('collegeAcronymInput').value = collegeAcronym;

    // Fetch and update the chart with the campus and college data
    fetchAndUpdateChart();

    // Show the modal
    document.getElementById("campusAnalysisModal").classList.remove("hidden");
}

function closeCampusAnalyticsModal() {
    document.getElementById('campusAnalysisModal').classList.add('hidden');
}

function loadChart(data) {
    if (activeTab === "sentiment") {
        loadSentimentChart(data);
    } else if (activeTab === "topic") {
        loadTopicChart(data);
    } else if (activeTab === "needsanalysis") {
        loadNeedsAnalysisChart(data);
    } else if (activeTab === "comments") {
        loadComments(data);
    }
}

function loadSentimentChart(data) {
    if (analysisChartInstance) analysisChartInstance.destroy();
    const ctx = document.getElementById('analysisChart').getContext('2d');

    function parseFilename(filename) {
        const [startYear, endYear, semester] = filename.split('_').map(Number);
        return {
            startYear,
            endYear,
            semester
        };
    }
    function formatLabel(parsedFilename) {
        const semesterString = parsedFilename.semester === 1 ? '1st Sem' : '2nd Sem';
        return `A.Y. ${parsedFilename.startYear}-${parsedFilename.endYear} ${semesterString}`;
    }

    // group by filename
    const buckets = {};
    data.sentiment.forEach(({ filename, sentiment_score }) => {
        // Initialize the bucket for the filename if it doesn't exist
        if (!buckets[filename]) {
            buckets[filename] = { positive: 0, negative: 0 };
        }

        // Safely increment positive or negative count
        if (sentiment_score == "Positive") {
            buckets[filename].positive++;
        } else if (sentiment_score == "Negative") {
            buckets[filename].negative++;
        }
    });

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

    console.log("Buckets:", buckets);
    console.log("Positive Data:", positiveData);
    console.log("Negative Data:", negativeData);
    console.log("Formatted Labels:", labels);

    analysisChartInstance = new Chart(ctx, {
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

function loadTopicChart(data) {
    if (topicChartInstance) topicChartInstance.destroy();
    const ctx = document.getElementById('topicChart').getContext('2d');

    console.log('Topics data:', data.topics);

    // count & split sentiments
    const tCounts = {}, tSents = {};
    data.topics.forEach(({ topic, sentiment }) => {
        if (!topic || !sentiment) return;
        if (!tCounts[topic]) {
            tCounts[topic] = 0;
            tSents[topic] = { positive: 0, negative: 0 };
        }
        tCounts[topic]++;
        tSents[topic][sentiment.toLowerCase()]++;
    });

    console.log('Topic Counts:', tCounts);
    console.log('Topic Sentiments:', tSents);

    const topTopics = Object.keys(tCounts)
        .sort((a, b) => tCounts[b] - tCounts[a])
        .slice(0, 10);
    const pos = topTopics.map(t => tSents[t].positive);
    const neg = topTopics.map(t => tSents[t].negative);

    topicChartInstance = new Chart(ctx, {
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
function loadNeedsAnalysisChart(data) {
    if (needsAnalysisChartInstance) {
        needsAnalysisChartInstance.destroy();
    }
    const ctx = document.getElementById('needsAnalysisChart').getContext('2d');

    let negativeTopicCounts = {};

    if (data && data.topics) {
        data.topics.forEach(({ topic, sentiment }) => {
            if (topic && topic.trim() !== "" && sentiment && sentiment.toLowerCase() === "negative") {
                negativeTopicCounts[topic] = (negativeTopicCounts[topic] || 0) + 1;
            }
        });
    }

    const sortedTopics = Object.keys(negativeTopicCounts)
        .sort((a, b) => negativeTopicCounts[b] - negativeTopicCounts[a])
        .slice(0, 10); // Display top 10 negative topics

    const topicLabels = sortedTopics.map(topic => topic);
    const topicData = sortedTopics.map(topic => negativeTopicCounts[topic]);

    needsAnalysisChartInstance = new Chart(ctx, {
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
function loadComments(data) {
    const commentsList = document.getElementById('commentsList');
    const topicFilter = document.getElementById('topicFilter');
    const sentimentFilter = document.getElementById('sentimentFilter');

    commentsList.innerHTML = '';
    topicFilter.innerHTML = '<option value="all">All Topics</option>';
    sentimentFilter.innerHTML = '<option value="all">All Sentiments</option>';

    globalCombinedComments = data.comments;  // directly use top-level array

    // populate filters
    [...new Set(data.comments.map(c => c.topic))]
        .forEach(topic => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = topic;
            topicFilter.appendChild(opt);
        });
    [...new Set(data.comments.map(c => c.sentiment))]
        .forEach(sent => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = sent;
            sentimentFilter.appendChild(opt);
        });

    renderFilteredComments();
}