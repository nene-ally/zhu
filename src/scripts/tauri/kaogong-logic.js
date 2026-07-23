export function summarizeLast7Days(data, today = new Date()) {
    const rows = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date(today);
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() - offset);
        const key = date.toISOString().slice(0, 10);
        const day = data.checkins.filter((item) => item.date === key);
        rows.push({ date: key, total: day.reduce((sum, item) => sum + item.totalQuestions, 0), wrong: day.reduce((sum, item) => sum + item.wrongQuestions, 0) });
    }
    return rows;
}

export function toggleWrongQuestion(data, id) {
    const item = data.wrongQuestions.find((question) => question.id === id);
    if (item) item.status = item.status === 'mastered' ? 'review' : 'mastered';
    return data;
}
