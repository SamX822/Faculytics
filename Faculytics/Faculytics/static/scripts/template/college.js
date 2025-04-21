let analysisChartInstance = null;
let topicChartInstance = null;
let uname = "";
let currentData = null;
let currentFileName = "overall";
let activeTab = "sentiment";

// Toggle actions for teacher card
function toggleTeacherActions(username) {
    const actionsDiv = document.getElementById(`actions-${username}`);
const arrow = document.getElementById(`arrow-${username}`);

if (actionsDiv.classList.contains('hidden')) {
    actionsDiv.classList.remove('hidden');
actionsDiv.classList.add('flex');
arrow.classList.add('rotate-180');
    } else {
    actionsDiv.classList.add('hidden');
actionsDiv.classList.remove('flex');
arrow.classList.remove('rotate-180');
    }
}

function redirectToUploadHistory(uName, collegeAcronym) {
    window.location.href = "{{ url_for('uploadHistory') }}?teacher=" + encodeURIComponent(uName) + "&college=" + encodeURIComponent(collegeAcronym);
}

// Tab switching functionality
document.getElementById('sentimentTab').addEventListener('click', function() {
    document.getElementById('sentimentTab').classList.add('bg-blue-600');
document.getElementById('sentimentTab').classList.remove('bg-gray-700');
document.getElementById('topicTab').classList.add('bg-gray-700');
document.getElementById('topicTab').classList.remove('bg-blue-600');

document.getElementById('sentimentContent').classList.remove('hidden');
document.getElementById('sentimentContent').classList.add('block');
document.getElementById('topicContent').classList.add('hidden');
document.getElementById('topicContent').classList.remove('block');

activeTab = "sentiment";

// Reload the chart for the current selection
if (currentData) {
    loadChart(currentData, currentFileName);
    }
});

document.getElementById('topicTab').addEventListener('click', function() {
    document.getElementById('topicTab').classList.add('bg-blue-600');
document.getElementById('topicTab').classList.remove('bg-gray-700');
document.getElementById('sentimentTab').classList.add('bg-gray-700');
document.getElementById('sentimentTab').classList.remove('bg-blue-600');

document.getElementById('topicContent').classList.remove('hidden');
document.getElementById('topicContent').classList.add('block');
document.getElementById('sentimentContent').classList.add('hidden');
document.getElementById('sentimentContent').classList.remove('block');

activeTab = "topic";

// Reload the chart for the current selection
if (currentData) {
    loadChart(currentData, currentFileName);
    }
});

function openAnalysisModal(uName) {
    uname = uName;
document.getElementById('analysisModal').classList.remove('hidden');

// Reset active tab to sentiment analysis
document.getElementById('sentimentTab').click();

// Clear previous options in the dropdown
let fileSelect = document.getElementById('fileSelect');
fileSelect.innerHTML = "<option value='overall'>Overall</option>";

fetch("{{ url_for('analysis') }}?teacher=" + encodeURIComponent(uname) + "&include_topics=true")
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

fetch(`/analysis?teacher=${encodeURIComponent(uname)}&file_name=${fileName}&include_topics=true`)
        .then(response => response.json())
        .then(data => {
    console.log("Analysis Data:", data);
currentData = data;

// Update the chart with the selected file or overall data
loadChart(data, fileName);

// Update the recommendation message
document.getElementById('fileDetails').innerHTML = `<p>Recommendation: ${data.recommendation}</p>`;
        })
        .catch(error => console.error("Error fetching analysis data:", error));
});

function loadChart(data, fileName) {
    if (activeTab === "sentiment") {
    loadSentimentChart(data, fileName);
    } else {
    loadTopicChart(data, fileName);
    }
}

function loadSentimentChart(data, fileName) {
    if (analysisChartInstance) {
    analysisChartInstance.destroy();
    }

const ctx = document.getElementById('analysisChart').getContext('2d');

if (fileName === "overall") {
    // --- OVERALL VIEW (LINE CHART) ---
    function parseFilename(filename) {
        const [startYear, endYear, semester] = filename.split('_').map(Number);
        return { startYear, endYear, semester };
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
        const labels = sortedFiles.map(file => file.filename);
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
text: 'Files',
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
        // --- SPECIFIC FILE VIEW (BAR CHART) ---
        const selectedFile = data.files.find(file => file.filename === fileName);
if (!selectedFile) {
    console.error("File not found in dataset.");
return;
        }

        const positiveCount = selectedFile.sentiment.filter(s => s === "Positive").length;
        const negativeCount = selectedFile.sentiment.filter(s => s === "Negative").length;

analysisChartInstance = new Chart(ctx, {
    type: 'bar',
data: {
    labels: ["Positive", "Negative"],
datasets: [
{
    label: 'Sentiment Count',
data: [positiveCount, negativeCount],
backgroundColor: ['green', 'red'],
categoryPercentage: 0.8,
barPercentage: 0.8
                    }
]
            },
options: {
    responsive: true,
scales: {
    y: {
    beginAtZero: true,
title: {display: true, text: 'Count', color: 'white' },
ticks: {stepSize: 1, color: 'white' },
                    },
x: {
    title: {display: true, text: 'Sentiment Type', color: 'white' },
ticks: {color: 'white' }
                    }
                },
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
        const topicCounts = { };
const topicSentiments = { };

        data.files.forEach(file => {
            if (!file.topics) return;

// Parse topics if they're in string format
const topics = Array.isArray(file.topics) ? file.topics : JSON.parse(file.topics || "[]");
const sentiments = Array.isArray(file.sentiment) ? file.sentiment : JSON.parse(file.sentiment || "[]");

            // Count topics and their sentiments
            topics.forEach((topic, index) => {
                if (!topic || topic.trim() === "") return;  // Ignore empty or null topics
if (!topicCounts[topic]) {
    topicCounts[topic] = 0;
topicSentiments[topic] = {positive: 0, negative: 0 };
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
datasets: [
{
    label: 'Positive',
data: positiveData,
backgroundColor: 'rgba(40, 167, 69, 0.7)',
borderColor: 'rgba(40, 167, 69, 1)',
borderWidth: 1,
categoryPercentage: 0.8,
barPercentage: 0.4
                    },
{
    label: 'Negative',
data: negativeData,
backgroundColor: 'rgba(220, 53, 69, 0.7)',
borderColor: 'rgba(220, 53, 69, 1)',
borderWidth: 1,
categoryPercentage: 0.8,
barPercentage: 0.4
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
    } else {
        // --- SINGLE FILE TOPIC VIEW ---
        const selectedFile = data.files.find(file => file.filename === fileName);
if (!selectedFile) {
    console.error("File not found in dataset.");
return;
        }

// Parse topics and sentiments
const topics = Array.isArray(selectedFile.topics) ? selectedFile.topics : JSON.parse(selectedFile.topics || "[]");
const sentiments = Array.isArray(selectedFile.sentiment) ? selectedFile.sentiment : JSON.parse(selectedFile.sentiment || "[]");

// Count topics and their sentiments
const topicCounts = { };
const topicSentiments = { };

        topics.forEach((topic, index) => {
            if (!topicCounts[topic]) {
    topicCounts[topic] = 0;
topicSentiments[topic] = {positive: 0, negative: 0 };
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
datasets: [
{
    label: 'Positive',
data: positiveData,
backgroundColor: 'rgba(40, 167, 69, 0.7)',
borderColor: 'rgba(40, 167, 69, 1)',
borderWidth: 1,
categoryPercentage: 0.8,
barPercentage: 0.4
                    },
{
    label: 'Negative',
data: negativeData,
backgroundColor: 'rgba(220, 53, 69, 0.7)',
borderColor: 'rgba(220, 53, 69, 1)',
borderWidth: 1,
categoryPercentage: 0.8,
barPercentage: 0.4
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

function closeAnalysisModal() {
    document.getElementById('analysisModal').classList.add('hidden');
}