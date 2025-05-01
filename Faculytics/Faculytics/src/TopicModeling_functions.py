from sentence_transformers import SentenceTransformer
from transformers import pipeline
from bertopic import BERTopic
from umap import UMAP
from sklearn.feature_extraction.text import CountVectorizer
import pandas as pd
import numpy as np

class CommentProcessor:
    def __init__(self):
        # Load models only once
        self.bert_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

        self.candidate_labels = [
            "Teaching Effectiveness", "Preparedness and Punctuality", "Fairness and Supportiveness", "Student Engagement",
            "Professional Appearance", "Cleanliness and Classroom Management", "Teaching Quality",
            "Availability and Communication", "Tardiness", "Assessment Fairness and Difficulty",
            "Instructional Materials and Aids"
        ]

        # Initialize BERTopic once, adding n-gram support using CountVectorizer
        vectorizer = CountVectorizer(stop_words='english', ngram_range=(1, 2))  # Use both unigrams and bigrams
        self.topic_model = BERTopic(
            umap_model=UMAP(n_neighbors=15, min_dist=0.05, metric='cosine'),
            vectorizer_model=vectorizer,  # Use CountVectorizer for n-grams
            min_topic_size=5
        )

    def preprocess_comments(self, df):
        """ Clean and prepare text data """
        df["cleaned_comment"] = df["comment"].astype(str).str.lower().str.replace(r'\W+', ' ', regex=True)
        return df

    def encode_comments(self, comments):
        """ Generate sentence embeddings efficiently """
        return np.array(self.bert_model.encode(comments, convert_to_tensor=False))

    def classify_comments(self, comments):
        """ Perform batch classification to improve speed """
        results = self.classifier(comments, self.candidate_labels)
        topics = [res["labels"][0] for res in results]
        probabilities = [res["scores"][0] * 100 for res in results]  # Multiply by 100
        return topics, probabilities

    def process_comments(self, df):
        df = self.preprocess_comments(df)
        comments = df["cleaned_comment"].tolist()

        # Generate embeddings (single batch)
        embeddings = self.encode_comments(comments)

        # Perform classification (single batch)
        df["Final_Topic"], df["Topic_Probability"] = self.classify_comments(comments)

        # Calculate category distribution
        category_counts = df["Final_Topic"].value_counts(normalize=True).reset_index()
        category_counts.columns = ["Category", "Probability"]
        category_counts["Probability"] *= 100

        # Fit BERTopic using precomputed embeddings
        topics, _ = self.topic_model.fit_transform(comments, embeddings)

        # Extract top words for each topic
        word_counts = {}
        for topic in self.topic_model.get_topics().values():
            for word, prob in topic:
                word_counts[word] = word_counts.get(word, 0) + prob

        top_20_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:20]

        return (
            df[["comment", "Final_Topic", "Topic_Probability"]].to_dict(orient="records"),
            top_20_words,
            category_counts.to_dict(orient="records")
        )

