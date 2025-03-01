const dropArea = document.getElementById('drop-area');

const fileInput = document.getElementById('csv_file');
const fileInfo = document.getElementById('file-info');
const fileNameSpan = document.getElementById('file-name');
const fileSizeSpan = document.getElementById('file-size');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const resultTab = document.getElementById('resultTabs');

const checkIcon = document.getElementById('check-icon');
/*
    TODO:
    
    >> Change all alert dialogs to custom modals.
 */
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
/*
    All functions below processes the CSV files to return results
 */
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

/*
    UPDATED to be easier edit
*/

let commentsData = [];
let sentimentStyles = {};
let sentimentType = [];

const renderComments = (comments, sentiment) => {
    const commentsList = document.getElementById('commentsList');
    const commentsCount = document.querySelector("#commentsSection h3 span");

    commentsCount.textContent = `(${comments.length})`;

    // Store comments as objects containing text and sentiment
    commentsData = comments.map((text, i) => ({
        text,
        sentiment: sentiment[i] || "Neutral"
    }));

    sentimentType = sentiment;
    sentimentStyles = {
        Positive: {
            text: "text-green-800",
            border: "border-green-300",
            bg: "bg-gradient-to-r from-green-100 to-green-50",
            icon: "✅"
        },
        Negative: {
            text: "text-red-800",
            border: "border-red-300",
            bg: "bg-gradient-to-r from-red-100 to-red-50",
            icon: "❌"
        },
        Neutral: {
            text: "text-gray-800",
            border: "border-gray-300",
            bg: "bg-gradient-to-r from-gray-100 to-gray-50",
            icon: "💬"
        }
    };

    renderComments_APX();
};

function renderComments_APX() {
    const commentsList = document.getElementById("commentsList");

    commentsList.innerHTML = commentsData.map(({ text, sentiment }) => {
        const cleanComment = text.replace(/<br\s*\/?>/g, "<br>");
        const { text: textColor, border, bg, icon } = sentimentStyles[sentiment];

        return `
            <li class="p-4 rounded-xl shadow-md border ${border} ${bg} transition hover:shadow-lg transform hover:scale-[1.02] flex items-start space-x-3">
                <span class="text-lg">${icon}</span>
                <div class="flex-1">
                    <p class="text-sm leading-relaxed ${textColor}">${cleanComment}</p>
                    <span class="text-xs font-semibold text-gray-500">${sentiment}</span>
                </div>
            </li>
        `;
    }).join('');
}

function viewComments() {
    const commentsList = document.getElementById("commentsList");
    const toggleButton = document.getElementById("toggleComments");
    const sortFilter = document.getElementById("uploadFilterSort");

    if (commentsList.classList.contains("max-h-0")) {
        commentsList.classList.remove("max-h-0", "opacity-0");
        commentsList.classList.add("max-h-full", "opacity-100");
        sortFilter.classList.remove("hidden");
    } else {
        commentsList.classList.remove("max-h-full", "opacity-100");
        commentsList.classList.add("max-h-0", "opacity-0");
        sortFilter.classList.add("hidden");
    }

    toggleButton.innerHTML = commentsList.classList.contains("max-h-0")
        ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12H9m6 0a3 3 0 000-6H9a3 3 0 000 6m6 0a3 3 0 000 6H9a3 3 0 000-6" />
            </svg> View comments`
        : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg> Hide comments`;
}

function toggleSortSentiment() {
    const sortButton = document.getElementById("sortSentiment");
    const isActive = sortButton.classList.toggle("text-white");

    sortButton.classList.toggle("text-gray-400", !isActive);

    sortButton.innerHTML = isActive
        ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5l4.5 4.5 4.5-4.5M3 7.5l4.5-4.5 4.5 4.5M13.5 16.5l4.5 4.5 4.5-4.5M13.5 7.5l4.5-4.5 4.5 4.5" />
            </svg> Sorting: Positive First`
        : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5l4.5 4.5 4.5-4.5M3 7.5l4.5-4.5 4.5 4.5M13.5 16.5l4.5 4.5 4.5-4.5M13.5 7.5l4.5-4.5 4.5 4.5" />
            </svg> Sorting: Negative First`;

    sortSentiment(isActive);
}
function sortSentiment(isSorted) {
    const sentimentOrder = ["Positive", "Neutral", "Negative"]; // Define order

    commentsData.sort((a, b) => {
        const indexA = sentimentOrder.indexOf(a.sentiment);
        const indexB = sentimentOrder.indexOf(b.sentiment);
        return isSorted ? indexA - indexB : indexB - indexA;
    });

    renderComments_APX();
}

function toggleGridView() {
    const commentsList = document.getElementById("commentsList");
    const gridIcon = document.getElementById("gridIcon");
    const buttonText = document.getElementById("toggleGridView");

    const isGridView = commentsList.classList.toggle("grid");
    commentsList.classList.toggle("grid-cols-1", isGridView);
    commentsList.classList.toggle("md:grid-cols-2", isGridView);
    commentsList.classList.toggle("lg:grid-cols-3", isGridView);
    commentsList.classList.toggle("gap-4", isGridView);
    commentsList.classList.toggle("space-y-4", !isGridView); // Remove list spacing in grid view

    if (isGridView) {
        buttonText.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 6h15M4.5 12h15M4.5 18h15" />
            </svg> List View`;
    } else {
        buttonText.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.5h16.5M3.75 9h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
            </svg> Grid View`;
    }
}

function saveResultsToDatabase() {
    let course = document.getElementById('courseSelect').value;
    fetch('/upload', { method: 'GET' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Upload results:', data);

            // Now, fetch /saveToDatabase with a POST request
            return fetch('/saveToDatabase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: data.filename,
                    comments: data.comments,
                    sentiment: data.sentiment,
                    recommendation: data.recommendation,
                    course: course
                })
            });
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Save results:', data);
            alert('Data saved successfully!'); // Show success alert
            location.reload(); // Refresh the page
        })
        .catch(error => {
            console.error('Fetch error:', error);
            alert('An error occurred while saving data. Please try again.'); // Show error alert
        });
}
/*
TODO: Not working for now
 */
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
