import "@sweetalert2/theme-dark/dark.css";
import Swal from "sweetalert2";

export const Alert = (message, icon = "success", iconColor, time = 700) => {
	Swal.fire({
		text: message,
		icon: icon,
		background: "var(--background-color)",
		width: "300px",
		showConfirmButton: false,
		showCancelButton: false,
		timer: time,
		timerProgressBar: true,
		color: "#000",
		iconColor: iconColor || false,
		confirmButtonColor: "red",
		customClass: {
			popup: "custom-icon-size",
			container: "custom-zindex",
		},
	});
};

export const confirmAndDeleteVariant = async () => {
	const result = await Swal.fire({
		text: "You are about to delete this product permanently!",
		icon: "warning",
		background: "#e4e4e4ff",
		color: "#111",
		iconColor: "#f97316",
		width: "300px",
		showCancelButton: true,
		cancelButtonText: "Cancel",
		confirmButtonText: "Yes, delete it!",
		buttonsStyling: false, // ← disables default SweetAlert2 button styles
		customClass: {
			popup: "custom-icon-size",
			confirmButton: "confirm-btn",
			cancelButton: "cancel-btn",
			container: "custom-zindex",
		},
	});

	return result;
};
