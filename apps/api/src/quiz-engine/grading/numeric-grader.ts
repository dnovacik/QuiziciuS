export interface NumericAnswer {
  teamId: string;
  value: number;
}

export interface NumericGradeResult {
  teamId: string;
  distance: number;
  isCorrect: boolean;
}

export function gradeNumericNearest(answers: NumericAnswer[], correctValue: number): NumericGradeResult[] {
  if (answers.length === 0) return [];

  const withDistance = answers.map((a) => ({ ...a, distance: Math.abs(a.value - correctValue) }));
  const minDistance = Math.min(...withDistance.map((a) => a.distance));

  return withDistance.map(({ teamId, distance }) => ({
    teamId,
    distance,
    isCorrect: distance === minDistance,
  }));
}
