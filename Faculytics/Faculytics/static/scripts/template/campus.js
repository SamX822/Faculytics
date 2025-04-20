//Campus.js
let collegeChartInstance = null;
let collegeTopicChartInstance = null;

// College Modal Tab Logic
document.getElementById('collegeSentimentTab').addEventListener('click', function () {
    console.log("Sentiment tab clicked");

    // Show Sentiment content and hide Topic content
    document.getElementById('collegeSentimentContent').classList.remove('hidden');
    document.getElementById('collegeTopicContent').classList.add('hidden');

    // Update button styles for active tab
    this.classList.add('bg-blue-600');
    this.classList.remove('bg-gray-700');

    document.getElementById('collegeTopicTab').classList.remove('bg-blue-600');
    document.getElementById('collegeTopicTab').classList.add('bg-gray-700');
});

document.getElementById('collegeTopicTab').addEventListener('click', function () {
    console.log("Topic tab clicked");

    // Show Topic content and hide Sentiment content
    document.getElementById('collegeSentimentContent').classList.add('hidden');
    document.getElementById('collegeTopicContent').classList.remove('hidden');

    // Update button styles for active tab
    this.classList.add('bg-blue-600');
    this.classList.remove('bg-gray-700');

    document.getElementById('collegeSentimentTab').classList.remove('bg-blue-600');
    document.getElementById('collegeSentimentTab').classList.add('bg-gray-700');
});

document.getElementById('manage-colleges-btn').addEventListener('click', function () {
    const addForm = document.getElementById('add-college-form');
    const removeForm = document.getElementById('remove-college-form');

    if (addForm.style.display === 'none') {
        addForm.style.display = 'block';
        removeForm.style.display = 'block';
    } else {
        addForm.style.display = 'none';
        removeForm.style.display = 'none';
    }
});

function toggleCollegeActions(collegeAcronym) {
    document.querySelectorAll('[id^="actions-"]').forEach(el => el.classList.add('hidden'));
    const actions = document.getElementById('actions-' + collegeAcronym);
    actions.classList.toggle('hidden');
}

function openCollegeAnalysisModal(event, collegeAcronym) {
    event.stopPropagation();
    document.getElementById('collegeAnalysisModal').classList.remove('hidden');

    // Default to Sentiment tab
    document.getElementById('collegeSentimentTab').click();

    fetch(`/college_analysis?college_acronym=${encodeURIComponent(collegeAcronym)}&include_topics=true`)
        .then(response => response.json())
        .then(data => {
            console.log("College Analysis Data:", data);

            if (data.error) {
                document.getElementById('collegeDetails').innerHTML = `<p class="text-red-500">${data.error}</p>`;
                return;
            }

            // ---------- SENTIMENT CHART ----------
            const sentimentCtx = document.getElementById('collegeAnalysisChart').getContext('2d');
            if (collegeChartInstance) {
                collegeChartInstance.destroy();
            }

            const groupedSentiments = {};
            data.files.forEach(file => {
                const filename = file.filename;
                const sentiments = Array.isArray(file.sentiment)
                    ? file.sentiment
                    : JSON.parse(file.sentiment || "[]");

                if (!groupedSentiments[filename]) {
                    groupedSentiments[filename] = { positive: 0, negative: 0 };
                }

                sentiments.forEach(s => {
                    if (s === "Positive") groupedSentiments[filename].positive++;
                    else if (s === "Negative") groupedSentiments[filename].negative++;
                });
            });

            function parseFilename(filename) {
                const [startYear, endYear, semester] = filename.split('_').map(Number);
                return { startYear, endYear, semester };
            }

            const sortedFilenames = Object.keys(groupedSentiments).sort((a, b) => {
                const aParts = parseFilename(a);
                const bParts = parseFilename(b);
                if (aParts.startYear !== bParts.startYear) return aParts.startYear - bParts.startYear;
                if (aParts.endYear !== bParts.endYear) return aParts.endYear - bParts.endYear;
                return aParts.semester - bParts.semester;
            });

            const labels = sortedFilenames;
            positiveData = sortedFilenames.map(filename => groupedSentiments[filename].positive);
            negativeData = sortedFilenames.map(filename => groupedSentiments[filename].negative);

            collegeChartInstance = new Chart(sentimentCtx, {
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
                    plugins: {
                        title: {
                            display: true,
                            text: 'College Sentiment Trends',
                            color: 'white'
                        },
                        legend: {
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
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Files',
                                color: 'white'
                            },
                            ticks: {
                                color: 'white'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Sentiment Count',
                                color: 'white'
                            },
                            ticks: {
                                color: 'white'
                            }
                        }
                    }
                }
            });

            // ---------- TOPIC CHART ----------
            const topicCtx = document.getElementById('collegeTopicChart').getContext('2d');
            if (collegeTopicChartInstance) {
                collegeTopicChartInstance.destroy();
            }

            const topicCounts = {};
            const topicSentiments = {};

            // Count the topics and their sentiments (positive/negative)
            data.files.forEach(file => {
                const topics = Array.isArray(file.topics) ? file.topics : JSON.parse(file.topics || "[]");
                const sentiments = Array.isArray(file.sentiment) ? file.sentiment : JSON.parse(file.sentiment || "[]");

                topics.forEach((topic, index) => {
                    if (!topic || topic.trim() === "") return;

                    // Initialize topic count and sentiment data
                    if (!topicCounts[topic]) {
                        topicCounts[topic] = 0;
                        topicSentiments[topic] = { positive: 0, negative: 0 };
                    }

                    topicCounts[topic]++;

                    // Map sentiment to the corresponding topic
                    if (index < sentiments.length) {
                        if (sentiments[index] === "Positive") {
                            topicSentiments[topic].positive++;
                        } else {
                            topicSentiments[topic].negative++;
                        }
                    } else {
                        console.warn(`Mismatched sentiment for topic: "${topic}" at index ${index}`);
                    }
                });
            });

            console.log("All Topic Counts:", topicCounts);
            console.log("All Topic Sentiments:", topicSentiments);

            // Sort topics by frequency and get top 10
            const topTopics = Object.keys(topicCounts)
                .sort((a, b) => topicCounts[b] - topicCounts[a])
                .slice(0, 10);

            // Build positive and negative data arrays aligned with topTopics
            positiveData = topTopics.map(topic => topicSentiments[topic]?.positive || 0);
            negativeData = topTopics.map(topic => topicSentiments[topic]?.negative || 0);

            collegeTopicChartInstance = new Chart(topicCtx, {
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

            // ---------- DETAILS ----------
            document.getElementById('collegeDetails').innerHTML = `<p>Recommendation: ${data.recommendation}</p>`;
        })
        .catch(error => {
            console.error("Error fetching college analysis data:", error);
            document.getElementById('collegeDetails').innerHTML = `<p class="text-red-500">Failed to load analysis data.</p>`;
        });
}

function closeCollegeAnalysisModal() {
    document.getElementById('collegeAnalysisModal').classList.add('hidden');
}