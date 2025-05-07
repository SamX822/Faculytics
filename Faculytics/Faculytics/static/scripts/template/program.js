// program.js
let analysisChartInstance = null;
let topicChartInstance = null;
let needsAnalysisChartInstance = null;
let currentData = null;
let currentFileName = "overall";
let activeTab = "sentiment";
let uname = null;
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
        },
        recommendationsTab: {
            button: document.getElementById('recommendationsTab'),
            content: document.getElementById('recommendationsContent')
        }
    };


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


            if (uname && currentFileName) {
                fetchAndUpdateChart();
            }
        });
    });

    tabs.sentimentTab.button.click();
});

function renderFilteredComments() {
    const commentsList = document.getElementById('commentsList');
    const topicFilterValue = document.getElementById('topicFilter').value;
    const sentimentFilterValue = document.getElementById('sentimentFilter').value;

    commentsList.innerHTML = ""; // Clear previous comments

    let filtered = globalCombinedComments.filter(item => {
        const matchTopic = (topicFilterValue === "all" || item.topic === topicFilterValue);
        const matchSentiment = (sentimentFilterValue === "all" || item.sentiment === sentimentFilterValue);
        return matchTopic && matchSentiment;
    });

    if (filtered.length === 0) {
        commentsList.innerHTML = "<p class='text-white'>No comments found.</p>";
        return;
    }

    filtered.forEach(item => {
        const commentDiv = document.createElement('div');
        commentDiv.classList.add('mb-2', 'p-2', 'rounded', 'shadow-sm');

        if (item.sentiment === 'Positive') {
            commentDiv.classList.add('bg-green-100');
        } else if (item.sentiment === 'Negative') {
            commentDiv.classList.add('bg-red-100');
        } else {
            commentDiv.classList.add('bg-gray-100');
        }

        commentDiv.innerHTML = `
            <p class="text-gray-800">${item.text}</p>
            <div class="flex items-center justify-between mt-1">
                <span class="inline-block bg-gray-200 rounded-full px-2 py-1 text-xs font-semibold text-gray-700">Topic: ${item.topic}</span>
                <span class="inline-block bg-gray-200 rounded-full px-2 py-1 text-xs font-semibold text-gray-700">Sentiment: ${item.sentiment}</span>
            </div>
        `;
        commentsList.appendChild(commentDiv);
    });
}
function fetchAndUpdateChart() {
    if (!uname || !currentFileName) {
        console.error("Missing username or file name");
        return;
    }

    // Optimization: if currentData already matches currentFileName, just reload chart
    if (currentData && currentData.files && (
        currentFileName === "overall" ||
        currentData.files.some(file => file.filename === currentFileName)
    )) {
        console.log("Using cached data for", currentFileName);
        loadChart(currentData, currentFileName);
        return;
    }

    // Otherwise, fetch fresh data
    console.log("Fetching fresh data for", currentFileName);
    fetch(`/analysis?teacher=${encodeURIComponent(uname)}&file_name=${currentFileName}&include_topics=true&include_recommendations=true`)
        .then(response => response.json())
        .then(data => {
            console.log("Fetched analysis data:", data);
            currentData = data;
            loadChart(data, currentFileName);
        })
        .catch(error => console.error("Error fetching analysis data:", error));
}
function openAnalysisModal(username) {
    currentData = null;
    uname = username; // Capture username globally
    document.getElementById('analysisModal').classList.remove('hidden');

    // Reset active tab to sentiment analysis
    document.getElementById('sentimentTab').click();

    // Clear previous options in the dropdown
    let fileSelect = document.getElementById('fileSelect');
    fileSelect.innerHTML = "<option value='overall'>Overall</option>";

    fetch(`/analysis?teacher=${encodeURIComponent(username)}&include_topics=true&include_recommendations=true`)
        .then(response => response.json())
        .then(data => {
            console.log("Received data:", data);
            currentData = data;

            if (!data.files || data.files.length === 0) {
                document.getElementById('fileDetails').innerHTML = "<p>No uploads found for this teacher.</p>";
                return;
            }

            // Populate the file dropdown with all available files
            data.files.forEach(file => {
                let option = document.createElement("option");
                option.value = file.filename;
                option.textContent = file.filename;
                fileSelect.appendChild(option);
            });

            // Default to "overall"
            fileSelect.value = "overall";
            currentFileName = "overall";

            // Load the chart
            loadChart(data, "overall");
        })
        .catch(error => console.error("Error fetching files:", error));
}

document.getElementById('viewButton').addEventListener('click', function () {
    const fileName = document.getElementById('fileSelect').value;
    currentFileName = fileName;

    fetchAndUpdateChart();
});

function closeAnalysisModal() {
    document.getElementById('analysisModal').classList.add('hidden');
}

function loadChart(data, fileName) {
    if (activeTab === "sentiment") {
        loadSentimentChart(data, fileName);
    } else if (activeTab === "topic") {
        loadTopicChart(data, fileName);
    } else if (activeTab === "needsanalysis") {
        loadNeedsAnalysisChart(data, fileName);
    } else if (activeTab === "comments") {
        loadComments(data, fileName);
    } else if (activeTab === 'recommendations') {
        loadRecommendations(data, currentFileName);
    }
}

function loadSentimentChart(data, fileName) {
    if (analysisChartInstance) {
        analysisChartInstance.destroy();
    }

    const ctx = document.getElementById('analysisChart').getContext('2d');
    const canvas = ctx.canvas;

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

    if (fileName === "overall") {
        // --- OVERALL VIEW (LINE CHART) ---

        canvas.classList.remove('doughnut-chart');
        canvas.width = '';  // Reset inline width
        canvas.height = ''; // Reset inline height
        function parseFilename(filename) {
            const [startYear, endYear, semester] = filename.split('_').map(Number);
            return {
                startYear,
                endYear,
                semester
            };
        }

        // Sort files chronologically
        const sortedFiles = [...data.files].sort((a, b) => {
            const aParts = parseFilename(a.filename);
            const bParts = parseFilename(b.filename);

            if (aParts.startYear !== bParts.startYear) {
                return aParts.startYear - bParts.startYear;
            } else if (aParts.endYear !== bParts.endYear) {
                return aParts.endYear - bParts.endYear;
            } else {
                return aParts.semester - bParts.semester;
            }
        });
        // Extract labels and sentiment data from sorted list
        const labels = sortedFiles.map(file => formatLabel(parseFilename(file.filename)));
        const positiveData = sortedFiles.map(file => {
            const sentimentData = Array.isArray(file.sentiment) ? file.sentiment : JSON.parse(file.sentiment || "[]");
            return sentimentData.filter(s => s === "Positive").length;
        });
        const negativeData = sortedFiles.map(file => {
            const sentimentData = Array.isArray(file.sentiment) ? file.sentiment : JSON.parse(file.sentiment || "[]");
            return sentimentData.filter(s => s === "Negative").length;
        });
        // Chart with files on the x-axis
        analysisChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
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
    } else {
        // --- SPECIFIC FILE VIEW (DOUGHNUT CHART) ---
        canvas.classList.add('doughnut-chart');
        canvas.width = 400;
        canvas.height = 400;

        const selectedFile = data.files.find(file => formatLabel(parseFilename(file.filename)));
        if (!selectedFile) {
            console.error("File not found in dataset.");
            return;
        }

        const positiveCount = selectedFile.sentiment.filter(s => s === "Positive").length;
        const negativeCount = selectedFile.sentiment.filter(s => s === "Negative").length;

        analysisChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ["Positive", "Negative"],
                datasets: [{
                    label: 'Sentiment Count',
                    data: [positiveCount, negativeCount],
                    backgroundColor: ['green', 'red']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: 'white',
                            font: {
                                weight: 'bold'
                            }
                        }
                    }
                }
            }
        });
    }
}

function loadTopicChart(data, fileName) {
    if (topicChartInstance) {
        topicChartInstance.destroy();
    }
    const ctx = document.getElementById('topicChart').getContext('2d');
    if (fileName === "overall") {
        // --- OVERALL TOPIC VIEW ---
        // Aggregate topics across all files
        const topicCounts = {};
        const topicSentiments = {};
        data.files.forEach(file => {
            if (!file.topics) return;
            // Parse topics if they're in string format
            const topics = Array.isArray(file.topics) ? file.topics : JSON.parse(file.topics || "[]");
            const sentiments = Array.isArray(file.sentiment) ? file.sentiment : JSON.parse(file.sentiment || "[]");
            // Count topics and their sentiments
            topics.forEach((topic, index) => {
                if (!topic || topic.trim() === "") return; // Ignore empty or null topics
                if (!topicCounts[topic]) {
                    topicCounts[topic] = 0;
                    topicSentiments[topic] = {
                        positive: 0,
                        negative: 0
                    };
                }
                topicCounts[topic]++;
                // Map sentiment to the corresponding topic
                if (index < sentiments.length) {
                    if (sentiments[index] === "Positive") {
                        topicSentiments[topic].positive++;
                    } else {
                        topicSentiments[topic].negative++;
                    }
                }
            });
        });
        // Sort topics by count and get top 10
        const topTopics = Object.keys(topicCounts)
            .sort((a, b) => topicCounts[b] - topicCounts[a])
            .slice(0, 10);
        const positiveData = topTopics.map(topic => topicSentiments[topic].positive);
        const negativeData = topTopics.map(topic => topicSentiments[topic].negative);
        topicChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topTopics,
                datasets: [{
                    label: 'Positive',
                    data: positiveData,
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1,
                    categoryPercentage: 0.8,
                    barPercentage: 0.4
                }, {
                    label: 'Negative',
                    data: negativeData,
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
                                return `${tooltipItem.dataset.label}: ${tooltipItem.raw} comments`;
                            }
                        }
                    }
                }
            }
        });
    } else {
        // --- SINGLE FILE TOPIC VIEW ---
        const selectedFile = data.files.find(file => file.filename === fileName);
        if (!selectedFile) {
            console.error("File not found in dataset.");
            return;
        }

        const topics = Array.isArray(selectedFile.topics) ? selectedFile.topics : JSON.parse(selectedFile.topics || "[]");
        const sentiments = Array.isArray(selectedFile.sentiment) ? selectedFile.sentiment : JSON.parse(selectedFile.sentiment || "[]");

        // Count topics and their sentiments
        const topicCounts = {};
        const topicSentiments = {};
        topics.forEach((topic, index) => {
            if (!topicCounts[topic]) {
                topicCounts[topic] = 0;
                topicSentiments[topic] = {
                    positive: 0,
                    negative: 0
                };
            }

            topicCounts[topic]++;

            // Map sentiment to the corresponding topic
            if (index < sentiments.length) {
                if (sentiments[index] === "Positive") {
                    topicSentiments[topic].positive++;
                } else {
                    topicSentiments[topic].negative++;
                }
            }
        });

        // Sort topics by count and get top 10
        const topTopics = Object.keys(topicCounts)
            .sort((a, b) => topicCounts[b] - topicCounts[a])
            .slice(0, 10);

        const positiveData = topTopics.map(topic => topicSentiments[topic].positive);
        const negativeData = topTopics.map(topic => topicSentiments[topic].negative);

        topicChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topTopics,
                datasets: [{
                    label: 'Positive',
                    data: positiveData,
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1,
                    categoryPercentage: 0.8,
                    barPercentage: 0.4
                }, {
                    label: 'Negative',
                    data: negativeData,
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
                            text: 'Topics',
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
                                return `${tooltipItem.dataset.label}: ${tooltipItem.raw} comments`;
                            }
                        }
                    }
                }
            }
        });
    }
}
function loadNeedsAnalysisChart(data, fileName) {
    if (needsAnalysisChartInstance) {
        needsAnalysisChartInstance.destroy();
    }
    const ctx = document.getElementById('needsAnalysisChart').getContext('2d');

    let negativeTopicCounts = {};

    const processFileTopics = (file) => {
        if (!file.topics || !file.sentiment) return;
        const topics = Array.isArray(file.topics) ? file.topics : JSON.parse(file.topics || "[]");
        const sentiments = Array.isArray(file.sentiment) ? file.sentiment : JSON.parse(file.sentiment || "[]");

        topics.forEach((topic, index) => {
            if (topic && topic.trim() !== "" && sentiments[index] === "Negative") {
                negativeTopicCounts[topic] = (negativeTopicCounts[topic] || 0) + 1;
            }
        });
    };

    if (fileName === "overall") {
        data.files.forEach(processFileTopics);
    } else {
        const selectedFile = data.files.find(file => file.filename === fileName);
        if (selectedFile) {
            processFileTopics(selectedFile);
        }
    }

    // Sort topics by count
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
                label: 'Areas Needing Improvement',
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
                    display: false, // We only have one dataset
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
function loadComments(data, fileName) {
    const commentsList = document.getElementById('commentsList');
    const topicFilter = document.getElementById('topicFilter');
    const sentimentFilter = document.getElementById('sentimentFilter');

    commentsList.innerHTML = ""; // Clear previous comments
    topicFilter.innerHTML = '<option value="all">All Topics</option>';
    sentimentFilter.innerHTML = '<option value="all">All Sentiments</option>';

    let combined = [];

    if (fileName === "overall") {
        data.files.forEach(file => {
            if (Array.isArray(file.comments) && Array.isArray(file.sentiment) && Array.isArray(file.topics)) {
                file.comments.forEach((text, index) => {
                    if (text && file.sentiment[index] && file.topics[index]) {
                        combined.push({
                            text,
                            sentiment: file.sentiment[index],
                            topic: file.topics[index]
                        });
                    }
                });
            }
        });
    } else {
        const selectedFile = data.files.find(file => file.filename === fileName);
        if (selectedFile && Array.isArray(selectedFile.comments) && Array.isArray(selectedFile.sentiment) && Array.isArray(selectedFile.topics)) {
            combined = selectedFile.comments.map((text, index) => ({
                text,
                sentiment: selectedFile.sentiment[index],
                topic: selectedFile.topics[index]
            }));
        }
    }

    // 🌟 Save combined comments globally
    globalCombinedComments = combined;

    // Populate topic filter
    const uniqueTopics = [...new Set(combined.map(c => c.topic))];
    uniqueTopics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        topicFilter.appendChild(option);
    });

    // Populate sentiment filter
    const uniqueSentiments = [...new Set(combined.map(c => c.sentiment))];
    uniqueSentiments.forEach(sentiment => {
        const option = document.createElement('option');
        option.value = sentiment;
        option.textContent = sentiment;
        sentimentFilter.appendChild(option);
    });

    // Display comments (initial load = all comments)
    renderFilteredComments();
}
function loadRecommendations(data, fileName) {
    const recommendationsContent = document.getElementById('recommendationsContent'); // Changed container ID
    recommendationsContent.innerHTML = ''; // Clear previous content

    let recommendationText = '';
    if (fileName === 'overall') {
        recommendationText = data.recommendation;
    } else {
        const selectedFile = data.files.find(file => file.filename === fileName);
        if (selectedFile && selectedFile.recommendation) {
            recommendationText = selectedFile.recommendation;
        }
    }

    if (recommendationText && recommendationText.trim() !== "") {
        let safeText = recommendationText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>"); // Handle line breaks with <br>

        // Convert Markdown bold (**) into HTML <strong> tags
        safeText = safeText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

        // For ordered lists (numbered)
        safeText = safeText.replace(/^(\d+)\.\s+/gm, "<ol class='list-decimal pl-5'><li>$1. "); // Starts ordered list item
        safeText = safeText.replace(/<\/li><ol class='list-decimal pl-5'><li>(\d+)\.\s+/g, "</li><li>$1. "); // Subsequent list items
        safeText = safeText.replace(/<\/li><\/ol><li>(\d+)\.\s+/g, "</li><li>$1. "); // Handle cases after a closed list
        safeText = safeText.replace(/<li>(\d+)\.\s+<br>/g, "<li>$1. "); // Clean up <br> after list start
        safeText = safeText.replace(/<\/li><br>/g, "</li>"); // Clean up <br> before list end
        safeText = safeText.replace(/<\/ol><br>/g, "</ol>"); // Clean up <br> after list end
        safeText = safeText.replace(/<\/ol><li>/g, "</ol><li class='mt-2'>"); // Add margin after a list
        safeText = safeText.replace(/<li>(.*?)<\/li>(?!<\/ol>)/g, "<li>$1</li>"); // Ensure single list items are closed
        safeText = safeText.replace(/<ol class='list-decimal pl-5'><li>(.*?)<\/li>(?!<\/ol>)/g, "<ol class='list-decimal pl-5'><li>$1</li></ol>"); // Basic single item list

        recommendationsContent.innerHTML = `<div class="leading-relaxed">${safeText}</div>`;
    } else {
        recommendationsContent.innerHTML = `<p class="text-gray-400 italic">No specific recommendations found for this view.</p>`;
    }
}