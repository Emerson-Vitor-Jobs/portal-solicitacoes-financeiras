with_sslmode_disabled() {
  case "$1" in
    *sslmode=*) printf '%s' "$1" ;;
    *\?*) printf '%s' "$1&sslmode=disable" ;;
    *) printf '%s' "$1?sslmode=disable" ;;
  esac
}
