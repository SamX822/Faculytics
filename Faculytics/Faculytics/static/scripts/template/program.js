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
    renderComments(sentimentData.comments, sentimentData.sentiment, sentimentData.topics);

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

function renderComments(comments, sentiments, topics) {
    const commentsList = document.getElementById('commentsList');
    const topicFilter = document.getElementById('topicFilter');
    const sentimentFilter = document.getElementById('sentimentFilter');

    // Combine comments with sentiment and topic
    const combined = comments.map((text, i) => ({
        text,
        sentiment: sentiments[i],
        topic: topics[i]
    }));

    // Populate unique topic options
    const uniqueTopics = [...new Set(topics)];
    topicFilter.innerHTML = '<option value="all">All Topics</option>';
    uniqueTopics.forEach(topic => {
        const opt = document.createElement('option');
        opt.value = topic;
        opt.textContent = topic;
        topicFilter.appendChild(opt);
    });

    // Filter + render logic
    function applyFilters() {
        const sentimentValue = sentimentFilter.value;
        const topicValue = topicFilter.value;

        const filtered = combined.filter(entry => {
            const sentimentMatch = sentimentValue === 'all' || entry.sentiment === sentimentValue;
            const topicMatch = topicValue === 'all' || entry.topic === topicValue;
            return sentimentMatch && topicMatch;
        });

        commentsList.innerHTML = '';
        filtered.forEach(entry => {
            const p = document.createElement('p');
            p.classList.add('p-3', 'rounded', 'bg-gray-700');
            p.innerHTML = `
                <span class="${entry.sentiment === 'Positive' ? 'text-green-400' : 'text-red-400'} font-semibold">
                    ${entry.sentiment}
                </span> - 
                <span class="text-blue-300 italic">${entry.topic}</span><br>
                <span>${entry.text}</span>
            `;
            commentsList.appendChild(p);
        });
    }

    // Initial render and bind filters
    applyFilters();
    sentimentFilter.onchange = applyFilters;
    topicFilter.onchange = applyFilters;
}

// Tab switching
const tabs = {
    sentimentTab: {
        button: document.getElementById('sentimentTab'),
        content: document.getElementById('sentimentContent')
    },
    topicTab: {
        button: document.getElementById('topicTab'),
        content: document.getElementById('topicContent')
    },
    commentsTab: {
        button: document.getElementById('commentsTab'),
        content: document.getElementById('commentsContent')
    }
};

Object.values(tabs).forEach(({ button }, _, allTabs) => {
    button.addEventListener('click', () => {
        allTabs.forEach(({ button, content }) => {
            button.classList.remove('bg-blue-600');
            button.classList.add('bg-gray-700');
            content.classList.add('hidden');
        });

        button.classList.add('bg-blue-600');
        button.classList.remove('bg-gray-700');
        tabs[button.id].content.classList.remove('hidden');

        // Show/hide filters only on comments tab
        const filtersVisible = button.id === 'commentsTab';
        document.getElementById('sentimentFilter').parentElement.style.display = filtersVisible ? 'flex' : 'none';
    });
});
