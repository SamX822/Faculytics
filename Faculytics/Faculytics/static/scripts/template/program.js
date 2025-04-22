// program.js

// Open the analysis modal and load chart data
function openAnalysisModal(username) {
    document.getElementById('analysisModal').classList.remove('hidden');

    fetch(`/analysis?teacher=${username}`)
        .then(response => response.json())
        .then(data => {
            populateFileSelect(data.files);
            updateCharts('overall', data);
            document.getElementById('viewButton').onclick = () => {
                const selectedFile = document.getElementById('fileSelect').value;
                const selected = selectedFile === 'overall' ? data : data.files.find(f => f.filename === selectedFile);
                updateCharts(selectedFile, data);
            };
        })
        .catch(error => {
            console.error("Error fetching analytics:", error);
        });
}

function closeAnalysisModal() {
    document.getElementById('analysisModal').classList.add('hidden');
}

function populateFileSelect(files) {
    const fileSelect = document.getElementById('fileSelect');
    fileSelect.innerHTML = '<option value="overall">Overall</option>';
    files.forEach(file => {
        const option = document.createElement('option');
        option.value = file.filename;
        option.textContent = file.filename;
        fileSelect.appendChild(option);
    });
}

function updateCharts(fileKey, data) {
    const sentimentData = fileKey === 'overall' ? data : data.files.find(f => f.filename === fileKey);

    const pos = sentimentData.sentiment.filter(s => s === 'Positive').length;
    const neg = sentimentData.sentiment.filter(s => s === 'Negative').length;

    renderSentimentChart(pos, neg);
    renderTopicChart(sentimentData.topics);
    document.getElementById('fileDetails').textContent = `Recommendation: ${data.recommendation}`;
}

function renderSentimentChart(positive, negative) {
    const ctx = document.getElementById('analysisChart').getContext('2d');
    if (window.sentimentChart) window.sentimentChart.destroy();

    window.sentimentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Positive', 'Negative'],
            datasets: [{
                label: 'Sentiment Count',
                data: [positive, negative],
                backgroundColor: ['#4ade80', '#f87171']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderTopicChart(topics) {
    const ctx = document.getElementById('topicChart').getContext('2d');
    if (window.topicChart) window.topicChart.destroy();

    const topicCounts = {};
    topics.forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    window.topicChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topTopics.map(t => t[0]),
            datasets: [{
                label: 'Topic Frequency',
                data: topTopics.map(t => t[1]),
                backgroundColor: '#60a5fa'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            indexAxis: 'y'
        }
    });
}

// Tab switching
const sentimentTab = document.getElementById('sentimentTab');
const topicTab = document.getElementById('topicTab');
const sentimentContent = document.getElementById('sentimentContent');
const topicContent = document.getElementById('topicContent');

sentimentTab.addEventListener('click', () => {
    sentimentTab.classList.add('bg-blue-600');
    topicTab.classList.remove('bg-blue-600');
    sentimentContent.classList.remove('hidden');
    topicContent.classList.add('hidden');
});

topicTab.addEventListener('click', () => {
    topicTab.classList.add('bg-blue-600');
    sentimentTab.classList.remove('bg-blue-600');
    topicContent.classList.remove('hidden');
    sentimentContent.classList.add('hidden');
});
