import { POPUP_TYPE } from '../../popup.js';
import { getKaogongData, saveKaogongData } from '../../tauri-bridge.js';
import { callTauriTavernPanelPopup } from './setting/panel-popup.js';
import { summarizeLast7Days, toggleWrongQuestion } from './kaogong-logic.js';

const SUBJECTS = ['行测', '申论', '常识判断', '数量关系', '判断推理', '资料分析'];

function blankData() {
    return { version: 1, checkins: [], wrongQuestions: [] };
}

function normalizeData(value) {
    const data = value && typeof value === 'object' ? value : blankData();
    return {
        version: 1,
        checkins: Array.isArray(data.checkins) ? data.checkins : [],
        wrongQuestions: Array.isArray(data.wrongQuestions) ? data.wrongQuestions : [],
    };
}

function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function renderStats(root, data) {
    root.replaceChildren();
    for (const row of summarizeLast7Days(data)) {
        const line = el('div', `${row.date}  ·  ${row.total} 题  ·  错 ${row.wrong}`, 'kaogong-stat-row');
        root.appendChild(line);
    }
}

function renderWrongQuestions(root, data, rerender) {
    root.replaceChildren();
    const pending = data.wrongQuestions.filter((item) => item.status !== 'mastered');
    if (pending.length === 0) {
        root.appendChild(el('div', '暂无待二刷错题', 'kaogong-empty'));
        return;
    }
    for (const item of pending) {
        const row = el('div', undefined, 'kaogong-wrong-row');
        const text = el('span', `${item.date} · ${item.subject} · ${item.question}`);
        const button = el('button', '标记已掌握', 'menu_button');
        button.type = 'button';
        button.addEventListener('click', async () => {
            toggleWrongQuestion(data, item.id);
            await saveKaogongData(data);
            rerender();
        });
        row.append(text, button);
        root.appendChild(row);
    }
}

export async function openKaogongPopup() {
    const data = normalizeData(await getKaogongData());
    const root = el('div', undefined, 'kaogong-panel');
    const form = el('form', undefined, 'kaogong-form');
    const subject = el('select');
    subject.className = 'text_pole';
    for (const value of SUBJECTS) subject.appendChild(el('option', value));
    const date = el('input'); date.type = 'date'; date.className = 'text_pole'; date.value = new Date().toISOString().slice(0, 10);
    const total = el('input'); total.type = 'number'; total.min = '0'; total.required = true; total.className = 'text_pole'; total.placeholder = '总题数';
    const wrong = el('input'); wrong.type = 'number'; wrong.min = '0'; wrong.required = true; wrong.className = 'text_pole'; wrong.placeholder = '错题数';
    const questions = el('textarea'); questions.className = 'text_pole'; questions.rows = 3; questions.placeholder = '错题记录，每行一题（可选）';
    const submit = el('button', '保存今日打卡', 'menu_button'); submit.type = 'submit';
    form.append(el('label', '科目'), subject, el('label', '日期'), date, el('label', '总题数'), total, el('label', '错题数'), wrong, el('label', '错题记录'), questions, submit);
    const feedback = el('div', '', 'kaogong-feedback');
    const stats = el('div', undefined, 'kaogong-stats');
    const wrongList = el('div', undefined, 'kaogong-wrong-list');
    root.append(el('h3', '今日打卡'), form, feedback, el('h3', '最近 7 日'), stats, el('h3', '错题列表'), wrongList);

    const rerender = () => { renderStats(stats, data); renderWrongQuestions(wrongList, data, rerender); };
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const totalValue = Math.max(0, Number(total.value));
        const wrongValue = Math.min(totalValue, Math.max(0, Number(wrong.value)));
        if (!Number.isFinite(totalValue) || !Number.isFinite(wrongValue)) return;
        const lines = questions.value.split('\n').map((line) => line.trim()).filter(Boolean);
        const idBase = `${date.value}-${Date.now()}`;
        data.checkins.push({ date: date.value, subject: subject.value, totalQuestions: totalValue, wrongQuestions: wrongValue });
        for (let index = 0; index < wrongValue; index += 1) {
            data.wrongQuestions.push({ id: `${idBase}-${index}`, date: date.value, subject: subject.value, question: lines[index] || `未记录题目 #${index + 1}`, status: 'review' });
        }
        await saveKaogongData(data);
        questions.value = ''; feedback.textContent = '已保存'; rerender();
    });
    rerender();
    await callTauriTavernPanelPopup(root, POPUP_TYPE.TEXT, '', { okButton: '关闭', allowVerticalScrolling: true, wider: true });
}
