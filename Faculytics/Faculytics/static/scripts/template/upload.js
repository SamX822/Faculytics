const dropArea = document.getElementById('drop-area');

const fileInput = document.getElementById('csv_file');
const fileInfo = document.getElementById('file-info');
const fileNameSpan = document.getElementById('file-name');
const fileSizeSpan = document.getElementById('file-size');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const resultTab = document.getElementById('resultTabs');

const checkIcon = document.getElementById('check-icon');

const processBtn = document.getElementById('processBtn');
const teacherUName = document.getElementById('teacherUName');
/*
    TODO:
    
    >> Change all alert dialogs to custom modals.
 */
document.addEventListener('DOMContentLoaded', function () {
    const startYearDropdown = document.getElementById('startYear');
    const endYearInput = document.getElementById('endYear');
    const semesterDropdown = document.getElementById('semester');
    const processBtn = document.getElementById('processBtn');
    const fileNamePreview = document.getElementById('fileNamePreview');
    const form = document.getElementById('uploadForm');

    if (!window.notifier) {
        window.notifier = new NotificationSystem({
            position: 'top-right',
            defaultDuration: 3000
        });
    }

    // Populate the year dropdowns (starting year from 1990 to current year)
    const currentYear = new Date().getFullYear();
    for (let year = 1990; year <= currentYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        startYearDropdown.appendChild(option);
    }

    startYearDropdown.addEventListener('change', function () {
        const startYear = parseInt(startYearDropdown.value);
        if (startYear) {
            const endYear = startYear + 1;
            endYearInput.value = endYear;
        } else {
            endYearInput.value = ''; // Clear if no start year selected
        }
        updateFileName();
    });

    // Enable process button only if all fields are valid
    const validateForm = () => {
        const startYear = startYearDropdown.value;
        const endYear = endYearInput.value;
        const semester = semesterDropdown.value;
        if (startYear && endYear && semester) {
            processBtn.disabled = false;
        } else {
            processBtn.disabled = true;
        }
        console.log('Start Year:', document.getElementById('startYear').value +
            ' ; End Year:', document.getElementById('endYear').value +
            ' ; Semester:', document.getElementById('semester').value);
    };

    // Update the file name preview based on selections
    startYearDropdown.addEventListener('change', updateFileName);
    endYearInput.addEventListener('change', updateFileName);
    semesterDropdown.addEventListener('change', updateFileName);

    // Function to update the file name preview
    function updateFileName() {
        const startYear = startYearDropdown.value;
        const endYear = endYearInput.value;
        const semester = semesterDropdown.value;
        if (startYear && endYear && semester) {
            fileNamePreview.textContent = `${startYear}${endYear}${semester}.csv`;  // Preview filename
        }
        validateForm();
    }

    // Handle file selection and file renaming
    fileInput.addEventListener('change', function () {
        const file = fileInput.files[0];
        if (file) {
            // Update both the file preview and the status section.
            document.getElementById('fileNamePreview').textContent = file.name; // show original file name
            fileNameSpan.textContent = file.name;
            const sizeInKB = (file.size / 1024).toFixed(2);
            fileSizeSpan.textContent = `${sizeInKB} KB`;
        }
    });
});
/*
    All functions below processes the CSV files to return results
 */
document.getElementById('uploadForm').addEventListener('submit', function (event) {
    event.preventDefault();

    const startYearDropdown = document.getElementById('startYear');
    const endYearInput = document.getElementById('endYear');
    const semesterDropdown = document.getElementById('semester');
    const fileInput = document.getElementById('csv_file');
    const finalGrade = document.getElementById('finalGrade').value;

    const startYear = startYearDropdown.value;
    const endYear = endYearInput.value;
    const semester = semesterDropdown.value;
    const file = fileInput.files[0];

    if (!startYear || !endYear || !semester || !file || !finalGrade) {
        alert('Please fill out all fields, select a file, and choose a final grade before uploading.');
        return;
    }

    const newFileName = `${startYear}${endYear}${semester}.csv`;

    const formData = new FormData();
    formData.append("csv_file", file, newFileName);
    formData.append("teacherUName", teacherUName.value);
    formData.append('startYear', startYear);
    formData.append('endYear', endYear);
    formData.append('semester', semester);
    formData.append("grade", finalGrade);

    console.log("New File Name: " + newFileName);

    document.getElementById("loadingSpinner").classList.remove("hidden");

    console.log("Processing...");

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Server error ${response.status}: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            document.getElementById("loadingSpinner").classList.add("hidden");

            if (data.error) {
                alert(data.error);
                return;
            }

            // Hide status indicators and show results
            checkIcon.classList.add('hidden');
            fileInfo.classList.add('hidden');
            processBtn.classList.add('hidden');
            resultTabs.classList.remove("hidden");
            commentsList.innerHTML = '';

            const sentimentCounts = {
                positive: data.sentiment.filter(s => s === "Positive").length,
                negative: data.sentiment.filter(s => s === "Negative").length
            };

            renderSentimentChart(sentimentCounts);
            renderComments(data.comments, data.sentiment);
            renderProcessedComments(data.processed_comments);
            renderTopWords(data.top_words);
            renderCategoryCounts(data.category_counts);
            updateRecommendation(data);
            console.log("Date Recommendation: ", data.recommendation);

            console.log('File uploaded successfully:', data);
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById("loadingSpinner").classList.add("hidden");
            alert('Error processing file: ' + error.message);
        });
});
/*
Copy this or use this for analysis
*/
function updateRecommendation(data) {
    const recommendationContainer = document.getElementById('recommendationText');

    if (!recommendationContainer) {
        console.error("Recommendation container not found.");
        return;
    }

    if (data.recommendation && data.recommendation.trim() !== "") {
        let safeText = data.recommendation
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>"); // Handle line breaks with <br>

        // Convert Markdown bold (**) into HTML <strong> tags
        safeText = safeText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

        // For ordered lists (numbered)
        safeText = safeText.replace(/^\d+\.\s+/gm, "<ol class='list-decimal pl-5'><li>"); // Starts ordered list
        safeText = safeText.replace(/^\d+\.\s+$/, "</li></ol>"); // Ends ordered list

        // Insert the formatted content into the container
        recommendationContainer.innerHTML = `<div class="leading-relaxed">${safeText}</div>`;
    } else {
        recommendationContainer.innerHTML = `<p class="text-gray-400 italic">No recommendation available at the moment.</p>`;
    }
}
let sentimentChart = null;
function renderSentimentChart(sentiment) {
    const ctx = document.getElementById('sentimentChart').getContext('2d');

    if (sentimentChart) {
        sentimentChart.destroy();
    }

    sentimentChart = new Chart(ctx, {
        type: 'doughnut',
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
        const cleanComment = String(text).replace(/<br\s*\/?>/g, "<br>");
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
                    teacherUName: teacherUName.value
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
            window.notifier.success("Save results", `Data saved successfully!`);
            setTimeout(() => {
                location.reload();
            }, 1500); // Delay to allow the user to see the message
        })
        .catch(error => {
            console.error('Fetch error:', error);
            window.notifier.error("Fetch error", "Error saving")
        });
}
/*
 TOPIC MODELLING I GUESS
 */
function renderProcessedComments(comments) {
    const tableBody = document.getElementById("commentsTableBody");
    tableBody.innerHTML = ''; // Clear previous content

    console.log(comments);

    comments.forEach(commentData => {
        const row = document.createElement("tr");
        row.className = "hover:bg-gray-100 transition-colors";
        row.innerHTML = `
            <td class="py-3 pr-4 max-w-xs truncate" title="${commentData.comment}">
                ${commentData.comment}
            </td>
            <td class="py-3 font-medium text-gray-800">
                ${commentData.Final_Topic}
            </td>
            <td class="py-3 text-right text-blue-600 font-semibold">
                ${commentData.Topic_Probability.toFixed(2)}%
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderTopWords(topWords) {
    const wordCloud = document.getElementById("wordCloud");
    wordCloud.innerHTML = ''; // Clear previous content

    console.log("Top Words:", topWords);

    topWords.forEach(wordData => {
        const wordSpan = document.createElement("span");
        const fontSize = Math.max(12, 12 + wordData[1] * 1.5);

        wordSpan.className = `
            inline-block px-2 py-1 
            bg-blue-100 text-blue-800 
            rounded-md cursor-default
            transition-all duration-200 
            hover:bg-blue-200
        `;
        wordSpan.style.fontSize = `${fontSize}px`;
        wordSpan.innerText = wordData[0];

        wordCloud.appendChild(wordSpan);
    });
}

function renderCategoryCounts(categoryCounts) {
    if (!categoryCounts || categoryCounts.length === 0) {
        console.error("Category counts data is missing or empty");
        return;
    }

    console.log("Category Counts Data:", categoryCounts);

    const ctx = document.getElementById("categoryChart").getContext("2d");

    // Destroy previous chart instance
    if (window.categoryChartInstance) {
        window.categoryChartInstance.destroy();
    }

    window.categoryChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: categoryCounts.map(c => c.Category),
            datasets: [{
                label: "Category Probability",
                data: categoryCounts.map(c => Number(c.Probability.toFixed(2))),
                backgroundColor: "rgba(59, 130, 246, 0.7)", // Soft blue
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true, // Prevents height from expanding
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Probability (%)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
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
