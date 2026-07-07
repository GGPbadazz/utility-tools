"""Minimal ctypes wrapper for the vendor LPAPI on Linux.

This module loads the native C library exposed in the C/C++ SDK and exposes
helpers that cover printer discovery and a handful of drawing primitives needed
by the Flask service.
"""

from __future__ import annotations

import ctypes
import logging
import os
import platform
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, List, Optional

LOGGER = logging.getLogger(__name__)


class NativeLpApiError(RuntimeError):
    """Raised when the native LPAPI layer cannot be initialised or used."""


class _DzptrDevice(ctypes.Structure):
    _fields_ = [
        ("addressType", ctypes.c_int),
        ("deviceName", ctypes.c_char * 32),
        ("deviceAddress", ctypes.c_char * 32),
    ]


class _DzptrPrinterInfo(ctypes.Structure):
    _fields_ = [
        ("name", ctypes.c_char * 32),
        ("deviceAddress", ctypes.c_char * 32),
        ("deviceAddrType", ctypes.c_int),
        ("deviceType", ctypes.c_int),
        ("deviceDPI", ctypes.c_int),
        ("deviceWidth", ctypes.c_int),
        ("printerDPI", ctypes.c_int),
        ("printerWidth", ctypes.c_int),
        ("vendorId", ctypes.c_int),
        ("productId", ctypes.c_int),
        ("usbVendorName", ctypes.c_char * 32),
        ("printerName", ctypes.c_char * 32),
        ("usbSerials", ctypes.c_char * 64),
        ("deviceName", ctypes.c_char * 32),
        ("macAddress", ctypes.c_char * 32),
        ("macAddressFull", ctypes.c_char * 32),
        ("manufacturer", ctypes.c_char * 32),
        ("seriesName", ctypes.c_char * 32),
        ("devIntName", ctypes.c_char * 32),
        ("softwareVersion", ctypes.c_char * 32),
        ("deviceVersion", ctypes.c_char * 32),
        ("manuShipTime", ctypes.c_char * 16),
        ("mcuId", ctypes.c_char * 32),
        ("peripheralFlags", ctypes.c_int),
        ("hardwareFlags", ctypes.c_int),
        ("softwareFlags", ctypes.c_int),
        ("attributeFlags", ctypes.c_int),
        ("printerAlignment", ctypes.c_int),
        ("language", ctypes.c_int),
        ("upgradeCRC", ctypes.c_int),
        ("printDarkness", ctypes.c_int),
        ("printSpeed", ctypes.c_int),
        ("gapType", ctypes.c_int),
        ("gapLength", ctypes.c_int),
        ("motorMode", ctypes.c_int),
        ("autoPowerOff", ctypes.c_int),
        ("hintVoice", ctypes.c_int),
        ("autoOutPage", ctypes.c_int),
        ("canSetGenFlags", ctypes.c_int),
        ("bufferSize", ctypes.c_int),
        ("printable", ctypes.c_int),
        ("chargeStatus", ctypes.c_int),
        ("batteryCount", ctypes.c_int),
        ("printerHeadTem", ctypes.c_int),
        ("batteryVoltage", ctypes.c_int),
    ]


@dataclass
class PrinterDevice:
    name: str
    address: str
    address_type: int


class NativeLpApi:
    """Thin ctypes-based bridge around liblpapi."""

    def __init__(self, base_dir: Optional[Path] = None) -> None:
        self._lib = self._load_library(base_dir)
        self._configure_signatures()

    @staticmethod
    def _resolve_lib_dir(base_dir: Optional[Path]) -> Path:
        env_lib_dir = os.environ.get("LPAPI_LIB_DIR")
        if env_lib_dir:
            lib_dir = Path(env_lib_dir)
            if (lib_dir / "liblpapi.so").exists():
                return lib_dir
            raise NativeLpApiError(f"LPAPI_LIB_DIR does not contain liblpapi.so: {lib_dir}")

        # 优先检查系统安装的库路径
        system_lib_paths = [
            Path("/usr/local/lib/lpapi"),
            Path("/usr/lib/lpapi"),
        ]
        for sys_path in system_lib_paths:
            if sys_path.exists() and (sys_path / "liblpapi.so").exists():
                return sys_path

        # 如果系统路径不存在，使用 SDK 路径
        if base_dir is None:
            base_dir = Path(__file__).resolve().parents[1]
        sdk_root = base_dir / "vendor" / "C_C++ SDK (Linux)" / "v2.5.20250212"
        arch_map = {
            "x86_64": "amd64",
            "AMD64": "amd64",
            "aarch64": "arm64",
            "arm64": "arm64",
            "armv7l": "armv7l",
        }
        machine = platform.machine()
        subdir = arch_map.get(machine)
        if not subdir:
            raise NativeLpApiError(f"Unsupported architecture: {machine}")
        lib_dir = sdk_root / subdir / "libs"
        if not lib_dir.exists():
            raise NativeLpApiError(f"Library directory not found: {lib_dir}")
        return lib_dir

    @classmethod
    def _load_library(cls, base_dir: Optional[Path]) -> ctypes.CDLL:
        lib_dir = cls._resolve_lib_dir(base_dir)
        # Load main library first
        lib_path = lib_dir / "liblpapi.so"
        if not lib_path.exists():
            raise NativeLpApiError(f"liblpapi.so not found in {lib_dir}")
        libc = ctypes.CDLL(str(lib_path), mode=ctypes.RTLD_GLOBAL)
        # Then preload dependencies that depend on main library symbols
        for dep_name in ("libdbus-ble.so",):
            dep_path = lib_dir / dep_name
            if dep_path.exists():
                ctypes.CDLL(str(dep_path), mode=ctypes.RTLD_GLOBAL)
        LOGGER.debug("Loaded LPAPI from %s", lib_path)
        return libc

    def _configure_signatures(self) -> None:
        lib = self._lib
        lib.lpapi_get_printers.argtypes = [
            ctypes.POINTER(ctypes.POINTER(_DzptrDevice)),
            ctypes.c_int,
            ctypes.c_char_p,
        ]
        lib.lpapi_get_printers.restype = ctypes.c_int

        lib.lpapi_open_printer.argtypes = [ctypes.c_char_p, ctypes.c_int]
        lib.lpapi_open_printer.restype = ctypes.c_int

        lib.lpapi_close_printer.argtypes = []
        lib.lpapi_close_printer.restype = None

        lib.lpapi_start_job.argtypes = [
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_int,
            ctypes.c_char_p,
        ]
        lib.lpapi_start_job.restype = ctypes.c_int

        lib.lpapi_commit_job.argtypes = []
        lib.lpapi_commit_job.restype = ctypes.c_int

        lib.lpapi_draw_text.argtypes = [
            ctypes.c_char_p,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_int,
        ]
        lib.lpapi_draw_text.restype = ctypes.c_int

        lib.lpapi_draw_rect.argtypes = [
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_double,
        ]
        lib.lpapi_draw_rect.restype = ctypes.c_int

        lib.lpapi_draw_qrcode.argtypes = [
            ctypes.c_char_p,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_double,
            ctypes.c_int,
        ]
        lib.lpapi_draw_qrcode.restype = ctypes.c_int

        lib.lpapi_set_item_horizontal_alignment.argtypes = [ctypes.c_int]
        lib.lpapi_set_item_horizontal_alignment.restype = None

        lib.lpapi_set_item_vertical_alignment.argtypes = [ctypes.c_int]
        lib.lpapi_set_item_vertical_alignment.restype = None

        lib.lpapi_set_fontname.argtypes = [ctypes.c_char_p]
        lib.lpapi_set_fontname.restype = None

    def list_printers(self, filter_module: Optional[str] = None) -> List[PrinterDevice]:
        max_count = 16
        device_array = (ctypes.POINTER(_DzptrDevice) * max_count)()
        module_filter = filter_module.encode() if filter_module else None
        count = self._lib.lpapi_get_printers(device_array, max_count, module_filter)
        devices: List[PrinterDevice] = []
        if count <= 0:
            return devices
        for idx in range(min(count, max_count)):
            device_ptr = device_array[idx]
            if not device_ptr:
                continue
            device = device_ptr.contents
            name = bytes(device.deviceName).decode("utf-8", errors="ignore").rstrip("\x00")
            address = bytes(device.deviceAddress).decode("utf-8", errors="ignore").rstrip("\x00")
            devices.append(PrinterDevice(name=name, address=address, address_type=device.addressType))
        return devices

    @contextmanager
    def connect(self, device: PrinterDevice) -> Iterator["_PrinterConnection"]:
        conn = _PrinterConnection(self._lib, device)
        try:
            conn.open()
            yield conn
        finally:
            conn.close()

    def print_sample_label(self, device: PrinterDevice, sample_info: dict, *,
                            label_width: float = 40.0, label_height: float = 60.0) -> None:
        with self.connect(device) as conn:
            job_name = f"sample-{os.getpid()}".encode()
            conn.start_job(label_width, label_height, 0, job_name)
            line_width = 0.4
            conn.draw_rect(0.0, 0.0, label_width, label_height, line_width)

            title_height = 8.0
            conn.draw_rect(0.0, 0.0, label_width, title_height, line_width)
            conn.draw_text(
                "化学分析样品标签",
                0.0,
                0.0,
                label_width,
                title_height,
                font_height=3.5,
                font_style=1,
                horizontal_alignment=1,
                vertical_alignment=1,
            )

            info_height = 14.0
            info_y = title_height
            line_height = info_height / 3.0
            sample_id = str(sample_info.get("sampleId", "N/A"))
            sample_type = str(sample_info.get("sampleType", "N/A"))
            analysis = str(sample_info.get("analysis", "N/A"))

            conn.draw_text(f"编号: {sample_id}", 1.0, info_y + line_height * 0, label_width - 2.0, line_height, 2.5)
            conn.draw_text(f"类型: {sample_type}", 1.0, info_y + line_height * 1, label_width - 2.0, line_height, 2.5)
            conn.draw_text(f"分析: {analysis}", 1.0, info_y + line_height * 2, label_width - 2.0, line_height, 2.5)

            qr_y = title_height + info_height
            qr_height = 8.0
            qr_size = 6.0
            qr_x = label_width - qr_size - 1.0
            from datetime import datetime

            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            qr_payload = (
                f"ID:{sample_id}|TYPE:{sample_type}|ANALYSIS:{analysis}|DATE:{timestamp}"
            )
            conn.draw_qrcode(qr_payload, qr_x, qr_y + 1.0, qr_size, qr_size, ecc_level=1)
            conn.draw_text(
                timestamp,
                1.0,
                qr_y,
                qr_x - 1.0,
                qr_height,
                font_height=2.0,
                horizontal_alignment=0,
                vertical_alignment=1,
            )
            conn.commit_job()


class _PrinterConnection:
    """Context-aware façade over the C function set."""

    def __init__(self, lib: ctypes.CDLL, device: PrinterDevice) -> None:
        self._lib = lib
        self._device = device
        self._opened = False

    def open(self) -> None:
        result = self._lib.lpapi_open_printer(self._device.name.encode(), self._device.address_type)
        if result != 0:
            raise NativeLpApiError(f"Failed to open printer '{self._device.name}' (code {result})")
        self._opened = True

    def close(self) -> None:
        if self._opened:
            try:
                self._lib.lpapi_close_printer()
            finally:
                self._opened = False

    def start_job(self, width: float, height: float, orientation: int, job_name: bytes) -> None:
        result = self._lib.lpapi_start_job(width, height, orientation, job_name)
        if result != 0:
            raise NativeLpApiError(f"lpapi_start_job failed with code {result}")

    def draw_rect(self, x: float, y: float, width: float, height: float, line_width: float) -> None:
        self._lib.lpapi_draw_rect(x, y, width, height, line_width)

    def draw_text(
        self,
        text: str,
        x: float,
        y: float,
        width: float,
        height: float,
        font_height: float,
        font_style: int = 0,
        horizontal_alignment: Optional[int] = None,
        vertical_alignment: Optional[int] = None,
    ) -> None:
        if horizontal_alignment is None:
            horizontal_alignment = 0
        if vertical_alignment is None:
            vertical_alignment = 0
        self._lib.lpapi_set_item_horizontal_alignment(horizontal_alignment)
        self._lib.lpapi_set_item_vertical_alignment(vertical_alignment)
        self._lib.lpapi_draw_text(text.encode(), x, y, width, height, font_height, font_style)

    def draw_qrcode(
        self,
        text: str,
        x: float,
        y: float,
        width: float,
        height: float,
        ecc_level: int = 1,
    ) -> None:
        self._lib.lpapi_draw_qrcode(text.encode(), x, y, width, height, ecc_level)

    def commit_job(self) -> None:
        result = self._lib.lpapi_commit_job()
        if result != 0:
            raise NativeLpApiError(f"lpapi_commit_job failed with code {result}")


__all__ = ["NativeLpApi", "NativeLpApiError", "PrinterDevice"]
