// teacher.js
let teacherAnalysisChartInstance = null;
let teacherTopicChartInstance = null;
let currData = null;
let currFileName = "overall";
let teacherActiveTab = "sentiment";
let teach_uname = null;
let globalTeacherCombinedComments = [];

document.addEventListener('DOMContentLoaded', () => {
    const topicFilterElement = document.getElementById('teacherTopicFilter');
    const sentimentFilterElement = document.getElementById('teacherSentimentFilter');
    const viewFileButton = document.getElementById('teacherViewFileAnalytics');

    if (topicFilterElement) {
        topicFilterElement.addEventListener('change', renderFilteredTeacherComments);
    }
    if (sentimentFilterElement) {
        sentimentFilterElement.addEventListener('change', renderFilteredTeacherComments);
    }
    if (viewFileButton) {
        viewFileButton.addEventListener('click', () => {
            const fileSelect = document.getElementById('teacherFileSelect');
            currFileName = fileSelect.value;
            fetchAndUpdateTeacherChart();
        });
    }

    const tabs = {
        sentimentTab: {
            button: document.getElementById('teacherSentimentTab'),
            content: document.getElementById('teacherSentimentContent')
        },
        topicTab: {
            button: document.getElementById('teacherTopicTab'),
            content: document.getElementById('teacherTopicContent')
        },
        commentsTab: {
            button: document.getElementById('teacherCommentsTab'),
            content: document.getElementById('teacherCommentsContent'),
            filters: document.getElementById('teacherCommentFilters') // Assuming you might add this ID later
        }
    };

    Object.values(tabs).forEach(({ button, content, filters }) => {
        if (button) {
            button.addEventListener('click', () => {
                Object.values(tabs).forEach(tab => {
                    if (tab.button) {
                        tab.button.classList.remove('bg-blue-600', 'text-white');
                        tab.button.classList.add('bg-gray-700', 'text-gray-300');
                    }
                    if (tab.content) {
                        tab.content.classList.add('hidden');
                    }
                    if (tab.filters) {
                        tab.filters.classList.add('hidden');
                    }
                });

                button.classList.add('bg-blue-600', 'text-white');
                button.classList.remove('bg-gray-700', 'text-gray-300');
                if (content) {
                    content.classList.remove('hidden');
                }
                if (filters) {
                    filters.classList.remove('hidden');
                }

                teacherActiveTab = button.id.replace('teacher', '').replace('Tab', '').toLowerCase();

                // Ensure currFileName is "overall" for the Sentiment tab
                if (teacherActiveTab === 'sentiment') {
                    currFileName = 'overall';
                }

                if (teach_uname) {
                    fetchAndUpdateTeacherChart();
                }
            });
        }
    });

    if (tabs.sentimentTab.button) {
        tabs.sentimentTab.button.click();
    }
});
function fetchAndUpdateTeacherChart() {
    if (!teach_uname || !currFileName) {
        console.error("Missing username or file name");
        return;
    }

    // Optimization: if currData already matches currFileName, just reload chart
    if (currData && currData.files && (
        currFileName === "overall" ||
        currData.files.some(file => file.filename === currFileName)
    )) {
        loadTeacherChart(currData, currFileName);
        return;
    }

    fetch(`/analysis?teacher=<span class="math-inline">\{encodeURIComponent\(teach_uname\)\}&file\_name\=</span>{encodeURIComponent(currFileName)}&include_topics=true`)
        .then(response => response.json())
        .then(data => {
            console.log("Fetched analysis data:", data);
            currData = data;
            loadTeacherChart(data, currFileName);
            const fileDetailsElement = document.getElementById('teacherFileDetails');
            if (fileDetailsElement && data.recommendation) {
                fileDetailsElement.innerHTML = `<p>Recommendation: ${data.recommendation}</p>`;
            } else if (fileDetailsElement) {
                fileDetailsElement.innerHTML = ""; // Or a default message
            }
        })
        .catch(error => console.error("Error fetching analysis data:", error));
}

function openTeacherAnalytics(username) {
    teach_uname = username;
    const modal = document.getElementById('teacherAnalyticsModal');
    if (modal) {
        modal.classList.remove('hidden');
    }

    const sentimentTabButton = document.getElementById('teacherSentimentTab');
    if (sentimentTabButton) {
        sentimentTabButton.click();
    }

    const fileSelect = document.getElementById('teacherFileSelect');
    if (fileSelect) {
        fileSelect.innerHTML = "<option value='overall'>Overall</option>";
    }

    fetch(`/analysis?teacher=${encodeURIComponent(teach_uname)}&include_topics=true`)
        .then(response => response.json())
        .then(data => {
            console.log("Received data:", data);
            currData = data;

            const fileDetailsElement = document.getElementById('teacherFileDetails');
            if (data.error && fileDetailsElement) {
                fileDetailsElement.innerHTML = `<p>${data.error}</p>`;
                return;
            }

            if (!data.files || data.files.length === 0) {
                if (fileDetailsElement) {
                    fileDetailsElement.innerHTML = "<p>No uploads found for you.</p>";
                }
                return;
            }

            if (fileSelect) {
                data.files.forEach(file => {
                    let option = document.createElement("option");
                    option.value = file.filename;
                    option.textContent = file.filename;
                    fileSelect.appendChild(option);
                });

                fileSelect.value = "overall";
                currFileName = "overall";

                // Load the chart for the initial overall data
                loadTeacherChart(data, "overall");
            }
        })
        .catch(error => console.error("Error fetching files:", error));
}

function closeTeacherAnalysisModal() {
    const modal = document.getElementById('teacherAnalyticsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function loadTeacherChart(data, fileName) {
    if (teacherActiveTab === "sentiment") {
        loadTeacherSentimentChart(data, fileName);
    } else if (teacherActiveTab === "topic") {
        loadTeacherTopicChart(data, fileName);
    } else if (teacherActiveTab === "comments") {
        loadTeacherComments(data, fileName);
    }
}

function loadTeacherSentimentChart(data, fileName) {
    if (teacherAnalysisChartInstance) {
        teacherAnalysisChartInstance.destroy();
    }

    const ctx = document.getElementById('teacherAnalysisChart')?.getContext('2d');
    if (!ctx) return;

    if (!data || data.error) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const text = data?.error || "No data available.";
        ctx.font = "16px Arial";
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    if (fileName === "overall") {
        // --- OVERALL VIEW (LINE CHART) ---
        function parseFilename(filename) {
            const [startYear, endYear, semester] = filename.split('_').map(Number);
            return { startYear, endYear, semester };
        }

        const sortedFiles = [...data.files].sort((a, b) => {
            const aParts = parseFilename(a.filename);
            const bParts = parseFilename(b.filename);
            if (aParts.startYear !== bParts.startYear) return aParts.startYear - bParts.startYear;
            if (aParts.endYear !== bParts.endYear) return aParts.endYear - bParts.endYear;
            return aParts.semester - bParts.semester;
        });
        const labels = sortedFiles.map(file => file.filename);
        const positiveData = sortedFiles.map(file => (Array.isArray(file.sentiment) ? file.sentiment : JSON.parse(file.sentiment || "[]")).filter(s => s === "Positive").length);
        const negativeData = sortedFiles.map(file => (Array.isArray(file.sentiment) ? file.sentiment : JSON.parse(file.sentiment || "[]")).filter(s => s === "Negative").length);

        teacherAnalysisChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [{ label: 'Positive', data: positiveData, borderColor: 'green', fill: false, pointStyle: 'circle', pointRadius: 5 }, { label: 'Negative', data: negativeData, borderColor: 'red', fill: false, pointStyle: 'circle', pointRadius: 5 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, title: { display: true, text: 'Sentiment Count', color: 'white' }, ticks: { stepSize: 1, color: 'white' } }, x: { title: { display: true, text: 'Files', color: 'white' }, ticks: { color: 'white' } } }, plugins: { legend: { display: true, labels: { color: 'white' } }, tooltip: { callbacks: { label: function (tooltipItem) { return `${tooltipItem.dataset.label}: ${tooltipItem.raw} sentiments`; } } } } }
        });
    } else {
        const selectedFile = data.files?.find(file => file.filename === fileName);
        if (!selectedFile) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = "16px Arial";
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText("File not found in data.", ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        const positiveCount = (Array.isArray(selectedFile.sentiment) ? selectedFile.sentiment : JSON.parse(selectedFile.sentiment || "[]")).filter(s => s === "Positive").length;
        const negativeCount = (Array.isArray(selectedFile.sentiment) ? selectedFile.sentiment : JSON.parse(selectedFile.sentiment || "[]")).filter(s => s === "Negative").length;

        teacherAnalysisChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: ["Positive", "Negative"], datasets: [{ label: 'Sentiment Count', data: [positiveCount, negativeCount], backgroundColor: ['green', 'red'], categoryPercentage: 0.8, barPercentage: 0.8 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, title: { display: true, text: 'Count', color: 'white' }, ticks: { stepSize: 1, color: 'white' } }, x: { title: { display: true, text: 'Sentiment Type', color: 'white' }, ticks: { color: 'white' } } }, plugins: { legend: { labels: { color: 'white', font: { weight: 'bold' } } } } }
        });
    }
}

function loadTeacherTopicChart(data, fileName) {
    if (teacherTopicChartInstance) {
        teacherTopicChartInstance.destroy();
    }
    const ctx = document.getElementById('teacherTopicChart')?.getContext('2d');
    if (!ctx) return;

    if (!data || data.error) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const text = data?.error || "No data available.";
        ctx.font = "16px Arial";
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    let allTopics = [];
    let allSentiments = [];
    if (fileName === "overall") {
        data.files.forEach(file => {
            if (file.topics) {
                allTopics.push(...file.topics);
            }
            if (file.sentiment) {
                allSentiments.push(...file.sentiment);
            }
        });
    } else {
        const selectedFile = data.files?.find(file => file.filename === fileName);
        if (selectedFile?.topics) {
            allTopics = selectedFile.topics;
        }
        if (selectedFile?.sentiment) {
            allSentiments = selectedFile.sentiment;
        }
    }

    const topicSentimentCounts = {};
    for (let i = 0; i < allTopics.length; i++) {
        const topic = allTopics[i];
        const sentiment = allSentiments[i];
        if (topic && sentiment) {
            if (!topicSentimentCounts[topic]) {
                topicSentimentCounts[topic] = { Positive: 0, Negative: 0 };
            }
            topicSentimentCounts[topic][sentiment]++;
        }
    }

    const sortedTopics = Object.entries(topicSentimentCounts)
        .sort(([, countsA], [, countsB]) => (countsB.Positive + countsB.Negative) - (countsA.Positive + countsA.Negative))
        .slice(0, 10);

    const labels = sortedTopics.map(item => item[0] || 'undefined');
    const positiveData = sortedTopics.map(item => item[1]?.Positive || 0);
    const negativeData = sortedTopics.map(item => item[1]?.Negative || 0);

    teacherTopicChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Positive', data: positiveData, backgroundColor: 'rgba(75, 192, 192, 0.7)' }, { label: 'Negative', data: negativeData, backgroundColor: 'rgba(255, 99, 132, 0.7)' }] },
        options: { responsive: true, scales: { y: { beginAtZero: true, title: { display: true, text: 'Count', color: 'white' }, ticks: { color: 'white' } }, x: { title: { display: true, text: 'Topic', color: 'white' }, ticks: { color: 'white' } } }, plugins: { legend: { labels: { color: 'white' } }, title: { display: true, text: (fileName === "overall" ? 'Top 10 Overall Topics by Sentiment' : `Top 10 Topics by Sentiment in ${fileName}`), color: 'white' } } }
    });
}

function loadTeacherComments(data, fileName) {
    const commentsList = document.getElementById('teacherCommentsList');
    const topicFilter = document.getElementById('teacherTopicFilter');
    const sentimentFilter = document.getElementById('teacherSentimentFilter'); // Get the sentiment filter element

    commentsList.innerHTML = "";
    if (topicFilter) topicFilter.innerHTML = "<option value='all'>All Topics</option>";
    if (sentimentFilter) sentimentFilter.innerHTML = "<option value='all'>All Sentiments</option>"; // Ensure "All Sentiments" is the default

    globalTeacherCombinedComments = [];

    if (!data || data.error) {
        commentsList.innerHTML = "<p class='text-white'>" + (data?.error || "No data available.") + "</p>";
        return;
    }

    let currentFileComments = [];

    if (fileName === "overall") {
        data.files.forEach(file => {
            if (file.comments) {
                currentFileComments.push(...file.comments.map((comment, index) => ({
                    text: comment,
                    topic: file.topics?.[index],
                    sentiment: file.sentiment?.[index]
                })));
            }
        });
    } else {
        const selectedFile = data.files?.find(file => file.filename === fileName);
        if (selectedFile?.comments) {
            currentFileComments = selectedFile.comments.map((comment, index) => ({
                text: comment,
                topic: selectedFile.topics?.[index],
                sentiment: selectedFile.sentiment?.[index]
            }));
        }
    }
    globalTeacherCombinedComments = currentFileComments.filter(comment => comment.topic && comment.sentiment);

    // Populate Topic Filter
    const uniqueTopics = [...new Set(globalTeacherCombinedComments.map(c => c.topic).filter(Boolean))];
    if (topicFilter) {
        uniqueTopics.forEach(topic => {
            const option = document.createElement('option');
            option.value = topic;
            option.textContent = topic || 'undefined';
            topicFilter.appendChild(option);
        });
    }

    // Populate Sentiment Filter
    const uniqueSentiments = [...new Set(globalTeacherCombinedComments.map(c => c.sentiment).filter(Boolean))];
    if (sentimentFilter) {
        uniqueSentiments.forEach(sentiment => {
            const option = document.createElement('option');
            option.value = sentiment;
            option.textContent = sentiment;
            sentimentFilter.appendChild(option);
        });
    }

    renderFilteredTeacherComments();
}

function renderFilteredTeacherComments() {
    const commentsList = document.getElementById('teacherCommentsList');
    const topicFilterValue = document.getElementById('teacherTopicFilter')?.value;
    const sentimentFilterValue = document.getElementById('teacherSentimentFilter')?.value;

    if (!commentsList) return;

    commentsList.innerHTML = ""; // Clear previous comments

    let filtered = globalTeacherCombinedComments.filter(item => {
        const matchTopic = (topicFilterValue === "all" || item?.topic === topicFilterValue);
        const matchSentiment = (sentimentFilterValue === "all" || item?.sentiment === sentimentFilterValue);
        return matchTopic && matchSentiment;
    });

    if (filtered.length === 0) {
        commentsList.innerHTML = "<p class='text-white'>No comments found.</p>";
        return;
    }

    filtered.forEach(item => {
        const commentDiv = document.createElement('div');
        commentDiv.classList.add('mb-2', 'p-2', 'rounded', 'shadow-sm');

        const sentiment = item?.sentiment;
        if (sentiment === 'Positive') {
            commentDiv.classList.add('bg-green-100');
        } else if (sentiment === 'Negative') {
            commentDiv.classList.add('bg-red-100');
        } else {
            commentDiv.classList.add('bg-gray-100');
        }

        commentDiv.innerHTML = `
            <p class="text-gray-800">${item?.text || 'undefined'}</p>
            <div class="flex items-center justify-between mt-1">
                <span class="inline-block bg-gray-200 rounded-full px-2 py-1 text-xs font-semibold text-gray-700">Topic: ${item?.topic || 'undefined'}</span>
                <span class="inline-block bg-gray-200 rounded-full px-2 py-1 text-xs font-semibold text-gray-700">Sentiment: ${item?.sentiment || 'undefined'}</span>
            </div>
        `;
        commentsList.appendChild(commentDiv);
    });
}