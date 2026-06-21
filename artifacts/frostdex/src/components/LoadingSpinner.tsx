export const LoadingSpinner = () => (
  <div className="loading-container">
    <div className="loading-spinner-ring"></div>
    <style>
      {`
        .loading-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100vh;
          background-color: #0b0e11;
          gap: 16px;
        }
        .loading-spinner-ring {
          width: 48px;
          height: 48px;
          border: 3px solid rgba(56, 224, 248, 0.15);
          border-top-color: #38e0f8;
          border-radius: 50%;
          animation: frost-spin 0.9s linear infinite;
        }
        @keyframes frost-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}
    </style>
  </div>
);
