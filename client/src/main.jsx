import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("THREAD & CO render error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error">
          <strong>Trang vừa gặp lỗi hiển thị.</strong>
          <p>Dữ liệu của bạn vẫn được giữ nguyên. Hãy tải lại trang để tiếp tục.</p>
          <button onClick={() => window.location.reload()}>Tải lại trang</button>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
