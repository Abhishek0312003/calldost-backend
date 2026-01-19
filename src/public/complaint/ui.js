window.UI = {
    showLoader(show) {
      const loader = document.getElementById("loader");
      if (loader) loader.style.display = show ? "flex" : "none";
    },
  
    snackbar(message, type = "success") {
      const bar = document.getElementById("snackbar");
      if (!bar) return;
  
      bar.textContent = message;
      bar.className = `snackbar ${type} show`;
  
      setTimeout(() => {
        bar.classList.remove("show");
      }, 3000);
    }
  };
  