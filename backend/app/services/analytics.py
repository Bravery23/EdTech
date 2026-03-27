class AnalyticsService:
    def __init__(self):
        pass

    def analyze_student_sentiment(self, text: str) -> dict:
        """
        Analyzes the sentiment and engagement of a student's message.
        In a real application, this would call an NLP model or LLM.
        """
        text_lower = text.lower()
        if any(word in text_lower for word in ['khó quá', 'không hiểu', 'chán', 'nản', 'cho đáp án']):
            return {
                "sentiment": "negative",
                "engagement": "low",
                "flag": True,
                "reason": "Student is showing signs of frustration or disengagement."
            }
            
        return {
            "sentiment": "neutral_or_positive",
            "engagement": "normal",
            "flag": False,
            "reason": None
        }

    def predict_early_warning(self, student_id: int, recent_scores: list[float]) -> dict:
        """
        Predicts if a student needs early warning based on recent score trajectory.
        """
        if len(recent_scores) < 3:
            return {"warning": False}
            
        # Simple trend analysis: if the last 3 scores are strictly decreasing
        trend_decreasing = (recent_scores[-1] < recent_scores[-2] < recent_scores[-3])
        if trend_decreasing and recent_scores[-1] < 6.5:
             return {
                 "warning": True,
                 "message": "Điểm số đang có xu hướng giảm liên tục. Đề nghị giáo viên can thiệp.",
                 "severity": "high"
             }
             
        return {"warning": False}

analytics_service = AnalyticsService()
