import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import KeywordResearch from './pages/KeywordResearch';
import TechnicalAudit from './pages/TechnicalAudit';
import CompetitorAnalysis from './pages/CompetitorAnalysis';
import ContentOptimization from './pages/ContentOptimization';
import BlogWriter from './pages/BlogWriter';
import GoogleSearchConsole from './pages/GoogleSearchConsole';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="keywords" element={<KeywordResearch />} />
          <Route path="audit" element={<TechnicalAudit />} />
          <Route path="competitors" element={<CompetitorAnalysis />} />
          <Route path="content" element={<ContentOptimization />} />
          <Route path="blog" element={<BlogWriter />} />
          <Route path="gsc" element={<GoogleSearchConsole />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
