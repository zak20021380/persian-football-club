import { ImportantMatch, Prediction, User } from '../models/index.js';
import { scorePrediction } from './scoring.js';
import { AppError } from '../utils/errors.js';

export async function scoreMatch(matchId: string, homeScore?: number, awayScore?: number) {
  const initial = await ImportantMatch.findById(matchId);
  if (!initial) throw new AppError(404, 'بازی پیدا نشد');
  const finalHome = homeScore ?? initial.homeScore;
  const finalAway = awayScore ?? initial.awayScore;
  if (finalHome === undefined || finalAway === undefined) throw new AppError(400, 'نتیجه نهایی کامل نیست');

  const staleBefore = new Date(Date.now() - 5 * 60_000);
  const match = await ImportantMatch.findOneAndUpdate(
    {
      _id: matchId,
      $or: [
        { scoringLockedAt: { $exists: false } },
        { scoringLockedAt: null },
        { scoringLockedAt: { $lt: staleBefore } }
      ]
    },
    { $set: { homeScore: finalHome, awayScore: finalAway, status: 'finished', scoringLockedAt: new Date() } },
    { new: true }
  );
  if (!match) throw new AppError(409, 'محاسبه امتیاز این بازی هم‌اکنون در حال انجام است', 'SCORING_IN_PROGRESS');

  try {
    const predictions = await Prediction.find({ matchId: match._id });
    let updated = 0;
    for (const prediction of predictions) {
      const oldCorrect = prediction.pointsAwarded >= 10;
      const oldExact = prediction.pointsAwarded === 30;
      const result = scorePrediction(prediction, { homeScore: finalHome, awayScore: finalAway });
      const pointsDelta = result.points - prediction.pointsAwarded;
      const correctDelta = Number(result.correctOutcome) - Number(oldCorrect);
      const exactDelta = Number(result.exact) - Number(oldExact);
      prediction.pointsAwarded = result.points;
      prediction.scored = true;
      await prediction.save();
      if (pointsDelta || correctDelta || exactDelta) {
        await User.updateOne(
          { _id: prediction.userId },
          { $inc: { points: pointsDelta, weeklyPoints: pointsDelta, correctPredictions: correctDelta, exactPredictions: exactDelta } }
        );
      }
      updated += 1;
    }
    match.predictionsScored = true;
    match.scoringLockedAt = undefined;
    await match.save();
    return { match, predictionsUpdated: updated };
  } catch (error) {
    await ImportantMatch.updateOne({ _id: match._id }, { $unset: { scoringLockedAt: 1 } });
    throw error;
  }
}
