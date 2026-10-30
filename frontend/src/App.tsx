import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DeckPage } from "./pages/DeckPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { ImportPage } from "./pages/ImportPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { QuizPage } from "./pages/QuizPage";
import { ResultsPage } from "./pages/ResultsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="decks/:deckId" element={<DeckPage />} />
        <Route path="quiz/:quizId" element={<QuizPage />} />
        <Route path="results/:attemptId" element={<ResultsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
