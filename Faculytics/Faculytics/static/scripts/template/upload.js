const dropArea = document.getElementById('drop-area');

const fileInput = document.getElementById('csv_file');
const fileInfo = document.getElementById('file-info');
const fileNameSpan = document.getElementById('file-name');
const fileSizeSpan = document.getElementById('file-size');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const resultTab = document.getElementById('resultTabs');

const checkIcon = document.getElementById('check-icon');

function updateFileStatus(file) {
    if (!file) return;
    fileNameSpan.textContent = file.name;
    fileSizeSpan.textContent = (file.size / 1024).toFixed(2) + ' KB';

    checkIcon.classList.remove('hidden');
    fileInfo.classList.remove('hidden'); 

    processBtn.disabled = false;
    processBtn.classList.remove('hidden');
}
// Drag & Drop Events
dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('bg-gray-200');
});

dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('bg-gray-200');
});

dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('bg-gray-200');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        updateFileStatus(files[0]);
    }
});

// Browse File Selection
fileInput.addEventListener('change', (e) => {
    updateFileStatus(e.target.files[0]);
});

document.getElementById('uploadForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const formData = new FormData();
    const fileField = document.getElementById('csv_file');

    if (fileField.files.length === 0) {
        alert("Please select a CSV file.");
        return;
    }

    formData.append('csv_file', fileField.files[0]);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }
            checkIcon.classList.add('hidden'); 
            fileInfo.classList.add('hidden'); 
            processBtn.classList.add('hidden');
            resultTabs.classList.remove("hidden");
            commentsList.innerHTML = ''; 

            fileNameSpan.textContent = "No file selected";
            fileSizeSpan.textContent = "0KB";

            const sentimentCounts = {
                positive: data.sentiment.filter(s => s === "Positive").length,
                negative: data.sentiment.filter(s => s === "Negative").length
            };

            renderSentimentChart(sentimentCounts);
            renderComments(data.comments, data.sentiment);
            //renderWordCloud(data.topics);
            document.getElementById('recommendationText').innerHTML = data.recommendation;
        })
        .catch(error => console.error('Error:', error));
});

let sentimentChart = null;

function renderSentimentChart(sentiment) {
    const ctx = document.getElementById('sentimentChart').getContext('2d');

    if (sentimentChart) {
        sentimentChart.destroy();
    }

    sentimentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Positive', 'Negative'],
            datasets: [{
                label: 'Sentiment Analysis',
                data: [sentiment.positive, sentiment.negative],
                backgroundColor: ['#10B981', '#EF4444']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Sentiment Analysis' }
            }
        }
    });
}

function renderComments(comments, sentiment) {
    const commentsList = document.getElementById('commentsList');
    const commentsCount = document.querySelector("#commentsSection h3 span"); // Select the span for count

    commentsList.innerHTML = ''; // Clear previous comments

    // Update the number of comments dynamically
    commentsCount.textContent = `(${comments.length})`;

    for (let i = 0; i < comments.length; i++) {
        const listItem = document.createElement('li');
        listItem.innerHTML = comments[i].replace(/<br\s*\/?>/g, "<br>") +
            ` <span class="font-semibold">(${sentiment[i]})</span>`;

        // Tailwind styling
        listItem.classList.add(
            "p-2", "rounded-lg", "mb-2", "shadow-sm", "border", "text-sm", "leading-relaxed"
        );

        if (sentiment[i] === 'Positive') {
            listItem.classList.add("text-green-600", "border-green-400", "bg-green-50");
        } else if (sentiment[i] === 'Negative') {
            listItem.classList.add("text-red-600", "border-red-400", "bg-red-50");
        } else {
            listItem.classList.add("text-gray-600", "border-gray-300", "bg-gray-50");
        }

        commentsList.appendChild(listItem);
    }
}





function renderWordCloud(topics) {
    const container = document.getElementById('wordCloudContainer');
    container.innerHTML = "";
    topics.forEach(topic => {
        const topicDiv = document.createElement('div');
        topicDiv.className = "p-3 border rounded-lg shadow bg-gray-200";
        topicDiv.innerHTML = `<strong>${topic.Name}:</strong> Strength: ${topic.strength}`;
        container.appendChild(topicDiv);
    });
}

document.querySelectorAll('.tab-link').forEach(button => {
    button.addEventListener('click', function () {
        document.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active-tab'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));

        this.classList.add('active-tab');
        document.getElementById(this.dataset.target).classList.remove('hidden');
    });
});