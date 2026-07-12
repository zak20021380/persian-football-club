export interface QuizQuestionInput { id: string; correctOption: number; score: number; }
export interface QuizAnswerInput { questionId: string; option: number; }
export function scoreQuiz(questions: QuizQuestionInput[], answers: QuizAnswerInput[], multiplier = 1) {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.option]));
  const details = questions.map((question) => {
    const option = answerMap.get(question.id);
    const correct = option === question.correctOption;
    return { questionId: question.id, option: option ?? -1, correct, score: correct ? Math.round(question.score * multiplier) : 0 };
  });
  return { details, score: details.reduce((sum, item) => sum + item.score, 0), correctCount: details.filter((item) => item.correct).length };
}

export type PredictionOutcome = 'home'|'draw'|'away';
export function resultOutcome(homeScore: number, awayScore: number): PredictionOutcome {
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}
export function scorePrediction(prediction: { outcome: PredictionOutcome; homeScore?: number; awayScore?: number }, result: { homeScore: number; awayScore: number }) {
  const correctOutcome = prediction.outcome === resultOutcome(result.homeScore, result.awayScore);
  const exact = prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore;
  return { points: exact ? 30 : correctOutcome ? 10 : 0, correctOutcome, exact };
}
