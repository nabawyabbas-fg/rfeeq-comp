/*
 * The Rfeeq icon set, transcribed from the approved prototype's sprite.
 *
 * Kept as a sprite rather than converted to lucide equivalents: the set is
 * drawn to one weight (1.5 stroke on a 24 grid) and includes four icons with no
 * lucide counterpart at all — quran, hadith, library and arrowdiag. Swapping in
 * near-matches would make the mismatch show most on the icons that label a
 * corpus, which is exactly where a reader is being asked to trust a
 * distinction.
 *
 * `<use>` resolves `currentColor` against the referencing element, so one
 * sprite serves every size and both themes. Generated file — if an icon needs
 * changing, change it here; there is no upstream to regenerate from.
 */

/** Every icon the design uses. A name outside this union is a compile error. */
export type RfeeqIconName =
  | "x"
  | "check"
  | "info"
  | "alert"
  | "wifioff"
  | "refresh"
  | "search"
  | "plus"
  | "clock"
  | "sliders"
  | "chat"
  | "trash"
  | "edit"
  | "ext"
  | "arrowdiag"
  | "play"
  | "pause"
  | "quran"
  | "hadith"
  | "globe"
  | "library"
  | "shield"
  | "zap"
  | "layers"
  | "up"
  | "down"
  | "copy"
  | "share"
  | "send"
  | "back"
  | "chev"
  | "more"
  | "user"
  | "logout"
  | "sidebar"
  | "arrowup"
  | "moon"
  | "sun";

export function RfeeqIconSprite() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute" }}
    >
      <symbol id="i-x" viewBox="0 0 24 24">
        <path
          d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24">
        <path
          d="M5 14L8.5 17.5L19 6.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-info" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M12 16V12"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-alert" viewBox="0 0 24 24">
        <path
          d="M13.9248 21H10.0752C5.44476 21 3.12955 21 2.27636 19.4939C1.42317 17.9879 2.60736 15.9914 4.97574 11.9985L6.90057 8.75333C9.17559 4.91778 10.3131 3 12 3C13.6869 3 14.8244 4.91777 17.0994 8.75332L19.0243 11.9985C21.3926 15.9914 22.5768 17.9879 21.7236 19.4939C20.8704 21 18.5552 21 13.9248 21Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M12 9V13"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M12.125 16.75H12M12.25 16.75C12.25 16.8881 12.1381 17 12 17C11.8619 17 11.75 16.8881 11.75 16.75C11.75 16.6119 11.8619 16.5 12 16.5C12.1381 16.5 12.25 16.6119 12.25 16.75Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-wifioff" viewBox="0 0 24 24">
        <path
          d="M8.5 15.9996C9.36651 15.1331 10.4207 14.642 11.5 14.5264"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M5.5 12.5C8.67327 9.32673 12.6221 8.67087 16 10.5324"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M2 8.5C8.31579 3.16669 15.6842 3.16668 22 8.49989"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M21.0002 13.5L15.0002 19.5M21.0002 19.5L15.0002 13.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24">
        <path
          d="M20.0092 2V5.13219C20.0092 5.42605 19.6418 5.55908 19.4537 5.33333C17.6226 3.2875 14.9617 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-search" viewBox="0 0 24 24">
        <path
          d="M17 17L21 21"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-plus" viewBox="0 0 24 24">
        <path
          d="M12 4V20M20 12H4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-clock" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M12 8V12L14 14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-sliders" viewBox="0 0 24 24">
        <path
          d="M5.00018 20.0001L4.99994 14.0001"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M4.99994 11.0001V4.00006"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M8.99994 8.00006H14.9999"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M1.99994 14.0001H7.99994"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M15.9999 12.0001H21.9999"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M11.9997 8.00006L11.9999 4.00006"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M12.0002 20.0001L11.9999 11.0001"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M18.9999 12.0001L18.9999 4.00006"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M19.0002 20.0001L18.9999 15.0001"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-chat" viewBox="0 0 24 24">
        <path
          d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M12.1257 12H12.0007M8.125 12H8M16.125 12H16M12.2507 12C12.2507 12.1381 12.1388 12.25 12.0007 12.25C11.8627 12.25 11.7507 12.1381 11.7507 12C11.7507 11.8619 11.8627 11.75 12.0007 11.75C12.1388 11.75 12.2507 11.8619 12.2507 12ZM8.25 12C8.25 12.1381 8.13807 12.25 8 12.25C7.86193 12.25 7.75 12.1381 7.75 12C7.75 11.8619 7.86193 11.75 8 11.75C8.13807 11.75 8.25 11.8619 8.25 12ZM16.25 12C16.25 12.1381 16.1381 12.25 16 12.25C15.8619 12.25 15.75 12.1381 15.75 12C15.75 11.8619 15.8619 11.75 16 11.75C16.1381 11.75 16.25 11.8619 16.25 12Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-trash" viewBox="0 0 24 24">
        <path
          d="M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 11.9927 22C9.42312 22 8.1383 22 7.17905 21.4149C6.7048 21.1257 6.296 20.7408 5.97868 20.2848C5.33688 19.3626 5.25945 18.0801 5.10461 15.5152L4.5 5.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.8981 2.28601 9.80498 2.3459 9.71729 2.41317C9.32164 2.7167 9.10063 3.20155 8.65861 4.17126L8.05292 5.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M9.5 16.5L9.5 10.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M14.5 16.5L14.5 10.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-edit" viewBox="0 0 24 24">
        <path
          d="M16.4249 4.60509L17.4149 3.6151C18.2351 2.79497 19.5648 2.79497 20.3849 3.6151C21.205 4.43524 21.205 5.76493 20.3849 6.58507L19.3949 7.57506M16.4249 4.60509L9.76558 11.2644C9.25807 11.772 8.89804 12.4078 8.72397 13.1041L8 16L10.8959 15.276C11.5922 15.102 12.228 14.7419 12.7356 14.2344L19.3949 7.57506M16.4249 4.60509L19.3949 7.57506"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M18.9999 13.5C18.9999 16.7875 18.9999 18.4312 18.092 19.5376C17.9258 19.7401 17.7401 19.9258 17.5375 20.092C16.4312 21 14.7874 21 11.4999 21H11C7.22876 21 5.34316 21 4.17159 19.8284C3.00003 18.6569 3 16.7712 3 13V12.5C3 9.21252 3 7.56879 3.90794 6.46244C4.07417 6.2599 4.2599 6.07417 4.46244 5.90794C5.56879 5 7.21252 5 10.5 5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-ext" viewBox="0 0 24 24">
        <path
          d="M11.0991 3.00012C7.45013 3.00669 5.53932 3.09629 4.31817 4.31764C3.00034 5.63568 3.00034 7.75704 3.00034 11.9997C3.00034 16.2424 3.00034 18.3638 4.31817 19.6818C5.63599 20.9999 7.75701 20.9999 11.9991 20.9999C16.241 20.9999 18.3621 20.9999 19.6799 19.6818C20.901 18.4605 20.9906 16.5493 20.9972 12.8998"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M20.556 3.49612L11.0487 13.0586M20.556 3.49612C20.062 3.00151 16.7343 3.04761 16.0308 3.05762M20.556 3.49612C21.05 3.99074 21.0039 7.32273 20.9939 8.02714"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-arrowdiag" viewBox="0 0 24 24">
        <path
          d="M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15M16.5 7.5L6.5 17.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-play" viewBox="0 0 24 24">
        <path
          d="M18.8906 12.846C18.5371 14.189 16.8667 15.138 13.5257 17.0361C10.296 18.8709 8.6812 19.7884 7.37983 19.4196C6.8418 19.2671 6.35159 18.9776 5.95624 18.5787C5 17.6139 5 15.7426 5 12C5 8.2574 5 6.3861 5.95624 5.42132C6.35159 5.02245 6.8418 4.73288 7.37983 4.58042C8.6812 4.21165 10.296 5.12907 13.5257 6.96393C16.8667 8.86197 18.5371 9.811 18.8906 11.154C19.0365 11.7084 19.0365 12.2916 18.8906 12.846Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-pause" viewBox="0 0 24 24">
        <path
          d="M4 7C4 5.58579 4 4.87868 4.43934 4.43934C4.87868 4 5.58579 4 7 4C8.41421 4 9.12132 4 9.56066 4.43934C10 4.87868 10 5.58579 10 7V17C10 18.4142 10 19.1213 9.56066 19.5607C9.12132 20 8.41421 20 7 20C5.58579 20 4.87868 20 4.43934 19.5607C4 19.1213 4 18.4142 4 17V7Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M14 7C14 5.58579 14 4.87868 14.4393 4.43934C14.8787 4 15.5858 4 17 4C18.4142 4 19.1213 4 19.5607 4.43934C20 4.87868 20 5.58579 20 7V17C20 18.4142 20 19.1213 19.5607 19.5607C19.1213 20 18.4142 20 17 20C15.5858 20 14.8787 20 14.4393 19.5607C14 19.1213 14 18.4142 14 17V7Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-quran" viewBox="0 0 24 24">
        <path
          d="M19.6475 5.43668L18.9895 4.39419C18.6252 3.81704 18.443 3.52846 18.2044 3.50178C17.9657 3.4751 17.6993 3.74896 17.1664 4.29667C15.4443 6.06689 13.7221 5.80537 12 8.98839C10.2779 5.80537 8.55571 6.06689 6.83356 4.29667C6.30071 3.74896 6.03429 3.4751 5.79565 3.50178C5.557 3.52846 5.37485 3.81704 5.01054 4.39419L4.35251 5.43668C4.09827 5.83945 3.97115 6.04084 4.00553 6.2528C4.03991 6.46476 4.22324 6.60998 4.58991 6.90042L10.7724 11.7977C11.3634 12.2659 11.659 12.5 12 12.5C12.341 12.5 12.6366 12.2659 13.2276 11.7977L19.4101 6.90042C19.7768 6.60998 19.9601 6.46476 19.9945 6.2528C20.0288 6.04084 19.9017 5.83945 19.6475 5.43668Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M22 8.5L6 20.5V15.8043M2 8.5L18 20.5V15.8043"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-hadith" viewBox="0 0 24 24">
        <path
          d="M1.99219 7C1.99219 7.94281 1.99219 8.41421 2.28508 8.70711C2.57797 9 3.04938 9 3.99219 9H5.99219V5C5.99219 3.89543 5.09676 3 3.99219 3C2.88762 3 1.99219 3.89543 1.99219 5V7Z"
          stroke="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M9.99219 19V18C9.99219 17.0572 9.99219 16.5858 10.2851 16.2929C10.578 16 11.0494 16 11.9922 16H19.9922C20.935 16 21.4064 16 21.6993 16.2929C21.9922 16.5858 21.9922 17.0572 21.9922 18V19C21.9922 20.1046 21.0968 21 19.9922 21H7.99219C9.09676 21 9.99219 20.1046 9.99219 19Z"
          stroke="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M18.9922 16V7C18.9922 5.11438 18.9922 4.17157 18.4064 3.58579C17.8206 3 16.8778 3 14.9922 3H3.99219"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M9.99219 8H14.9922"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M9.99219 11H12.9922"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M5.99219 9V19C5.99219 20.1046 6.88762 21 7.99219 21C9.09676 21 9.99219 20.1046 9.99219 19V18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-globe" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 12C8 18 12 22 12 22C12 22 16 18 16 12C16 6 12 2 12 2C12 2 8 6 8 12Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M21 15H3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M21 9H3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-library" viewBox="0 0 24 24">
        <path
          d="M2 7C2 5.59987 2 4.8998 2.27248 4.36502C2.51217 3.89462 2.89462 3.51217 3.36502 3.27248C3.8998 3 4.59987 3 6 3C7.40013 3 8.1002 3 8.63498 3.27248C9.10538 3.51217 9.48783 3.89462 9.72752 4.36502C10 4.8998 10 5.59987 10 7V17C10 18.4001 10 19.1002 9.72752 19.635C9.48783 20.1054 9.10538 20.4878 8.63498 20.7275C8.1002 21 7.40013 21 6 21C4.59987 21 3.8998 21 3.36502 20.7275C2.89462 20.4878 2.51217 20.1054 2.27248 19.635C2 19.1002 2 18.4001 2 17V7Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M6.125 17H6M6.25 17C6.25 17.1381 6.13807 17.25 6 17.25C5.86193 17.25 5.75 17.1381 5.75 17C5.75 16.8619 5.86193 16.75 6 16.75C6.13807 16.75 6.25 16.8619 6.25 17Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M17.9062 16.6934H17.7812M18.0312 16.6934C18.0312 16.8314 17.9193 16.9434 17.7812 16.9434C17.6432 16.9434 17.5312 16.8314 17.5312 16.6934C17.5312 16.5553 17.6432 16.4434 17.7812 16.4434C17.9193 16.4434 18.0312 16.5553 18.0312 16.6934Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M2 7H10"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M11.4486 8.26843C11.0937 6.93838 10.9163 6.27336 11.0385 5.69599C11.146 5.18812 11.4108 4.72747 11.7951 4.38005C12.2319 3.98508 12.8942 3.80689 14.2187 3.4505C15.5432 3.09412 16.2055 2.91593 16.7804 3.03865C17.2862 3.1466 17.7449 3.41256 18.0909 3.79841C18.4842 4.23706 18.6617 4.90209 19.0166 6.23213L21.5514 15.7316C21.9063 17.0616 22.0837 17.7266 21.9615 18.304C21.854 18.8119 21.5892 19.2725 21.2049 19.62C20.7681 20.0149 20.1058 20.1931 18.7813 20.5495C17.4568 20.9059 16.7945 21.0841 16.2196 20.9614C15.7138 20.8534 15.2551 20.5874 14.9091 20.2016C14.5158 19.7629 14.3383 19.0979 13.9834 17.7679L11.4486 8.26843Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M12 8.00019L18.5001 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-shield" viewBox="0 0 24 24">
        <path
          d="M18.7088 3.49534C16.8165 2.55382 14.5009 2 12 2C9.4991 2 7.1835 2.55382 5.29116 3.49534C4.36318 3.95706 3.89919 4.18792 3.4496 4.91378C3 5.63965 3 6.34248 3 7.74814V11.2371C3 16.9205 7.54236 20.0804 10.173 21.4338C10.9067 21.8113 11.2735 22 12 22C12.7265 22 13.0933 21.8113 13.8269 21.4338C16.4576 20.0804 21 16.9205 21 11.2371L21 7.74814C21 6.34249 21 5.63966 20.5504 4.91378C20.1008 4.18791 19.6368 3.95706 18.7088 3.49534Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M9 11.5C9 11.5 10.4079 11.7519 11 13.5C11 13.5 12.5 10.5 15 9.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-zap" viewBox="0 0 24 24">
        <path
          d="M5.22576 11.3294L12.224 2.34651C12.7713 1.64397 13.7972 2.08124 13.7972 3.01707V9.96994C13.7972 10.5305 14.1995 10.985 14.6958 10.985H18.0996C18.8729 10.985 19.2851 12.0149 18.7742 12.6706L11.776 21.6535C11.2287 22.356 10.2028 21.9188 10.2028 20.9829V14.0301C10.2028 13.4695 9.80048 13.015 9.3042 13.015H5.90035C5.12711 13.015 4.71494 11.9851 5.22576 11.3294Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-layers" viewBox="0 0 24 24">
        <path
          d="M8.64298 3.14559L6.93816 3.93362C4.31272 5.14719 3 5.75397 3 6.75C3 7.74603 4.31272 8.35281 6.93817 9.56638L8.64298 10.3544C10.2952 11.1181 11.1214 11.5 12 11.5C12.8786 11.5 13.7048 11.1181 15.357 10.3544L17.0618 9.56638C19.6873 8.35281 21 7.74603 21 6.75C21 5.75397 19.6873 5.14719 17.0618 3.93362L15.357 3.14559C13.7048 2.38186 12.8786 2 12 2C11.1214 2 10.2952 2.38186 8.64298 3.14559Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M20.788 11.0972C20.9293 11.2959 21 11.5031 21 11.7309C21 12.7127 19.6873 13.3109 17.0618 14.5072L15.357 15.284C13.7048 16.0368 12.8786 16.4133 12 16.4133C11.1214 16.4133 10.2952 16.0368 8.64298 15.284L6.93817 14.5072C4.31272 13.3109 3 12.7127 3 11.7309C3 11.5031 3.07067 11.2959 3.212 11.0972"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M20.3767 16.2661C20.7922 16.5971 21 16.927 21 17.3176C21 18.2995 19.6873 18.8976 17.0618 20.0939L15.357 20.8707C13.7048 21.6236 12.8786 22 12 22C11.1214 22 10.2952 21.6236 8.64298 20.8707L6.93817 20.0939C4.31272 18.8976 3 18.2995 3 17.3176C3 16.927 3.20778 16.5971 3.62334 16.2661"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-up" viewBox="0 0 24 24">
        <path
          d="M2 12.5C2 11.3954 2.89543 10.5 4 10.5C5.65685 10.5 7 11.8431 7 13.5V17.5C7 19.1569 5.65685 20.5 4 20.5C2.89543 20.5 2 19.6046 2 18.5V12.5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M15.4787 7.80626L15.2124 8.66634C14.9942 9.37111 14.8851 9.72349 14.969 10.0018C15.0369 10.2269 15.1859 10.421 15.389 10.5487C15.64 10.7065 16.0197 10.7065 16.7791 10.7065H17.1831C19.7532 10.7065 21.0382 10.7065 21.6452 11.4673C21.7145 11.5542 21.7762 11.6467 21.8296 11.7437C22.2965 12.5921 21.7657 13.7351 20.704 16.0211C19.7297 18.1189 19.2425 19.1678 18.338 19.7852C18.2505 19.8449 18.1605 19.9013 18.0683 19.9541C17.116 20.5 15.9362 20.5 13.5764 20.5H13.0646C10.2057 20.5 8.77628 20.5 7.88814 19.6395C7 18.7789 7 17.3939 7 14.6239V13.6503C7 12.1946 7 11.4668 7.25834 10.8006C7.51668 10.1344 8.01135 9.58664 9.00069 8.49112L13.0921 3.96056C13.1947 3.84694 13.246 3.79012 13.2913 3.75075C13.7135 3.38328 14.3652 3.42464 14.7344 3.84235C14.774 3.8871 14.8172 3.94991 14.9036 4.07554C15.0388 4.27205 15.1064 4.37031 15.1654 4.46765C15.6928 5.33913 15.8524 6.37436 15.6108 7.35715C15.5838 7.46692 15.5488 7.5801 15.4787 7.80626Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-down" viewBox="0 0 24 24">
        <path
          d="M2 11.5C2 12.6046 2.89543 13.5 4 13.5C5.65685 13.5 7 12.1569 7 10.5V6.5C7 4.84315 5.65685 3.5 4 3.5C2.89543 3.5 2 4.39543 2 5.5V11.5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M15.4787 16.1937L15.2124 15.3337C14.9942 14.6289 14.8851 14.2765 14.969 13.9982C15.0369 13.7731 15.1859 13.579 15.389 13.4513C15.64 13.2935 16.0197 13.2935 16.7791 13.2935H17.1831C19.7532 13.2935 21.0382 13.2935 21.6452 12.5327C21.7145 12.4458 21.7762 12.3533 21.8296 12.2563C22.2965 11.4079 21.7657 10.2649 20.704 7.9789C19.7297 5.88111 19.2425 4.83222 18.338 4.21485C18.2505 4.15508 18.1605 4.0987 18.0683 4.04586C17.116 3.5 15.9362 3.5 13.5764 3.5H13.0646C10.2057 3.5 8.77628 3.5 7.88814 4.36053C7 5.22106 7 6.60607 7 9.37607V10.3497C7 11.8054 7 12.5332 7.25834 13.1994C7.51668 13.8656 8.01135 14.4134 9.00069 15.5089L13.0921 20.0394C13.1947 20.1531 13.246 20.2099 13.2913 20.2493C13.7135 20.6167 14.3652 20.5754 14.7344 20.1577C14.774 20.1129 14.8172 20.0501 14.9036 19.9245C15.0388 19.728 15.1064 19.6297 15.1654 19.5323C15.6928 18.6609 15.8524 17.6256 15.6108 16.6429C15.5838 16.5331 15.5488 16.4199 15.4787 16.1937Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-copy" viewBox="0 0 24 24">
        <path
          d="M7.5 14.5C7.5 11.2002 7.5 9.55025 8.52513 8.52513C9.55025 7.5 11.2002 7.5 14.5 7.5C17.7998 7.5 19.4497 7.5 20.4749 8.52513C21.5 9.55025 21.5 11.2002 21.5 14.5C21.5 17.7998 21.5 19.4497 20.4749 20.4749C19.4497 21.5 17.7998 21.5 14.5 21.5C11.2002 21.5 9.55025 21.5 8.52513 20.4749C7.5 19.4497 7.5 17.7998 7.5 14.5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M7.5 16.5C6.10355 16.5 5.40533 16.5 4.84402 16.3036C3.83866 15.9518 3.0482 15.1613 2.69641 14.156C2.5 13.5947 2.5 12.8964 2.5 11.5V9.5C2.5 6.20017 2.5 4.55025 3.52513 3.52513C4.55025 2.5 6.20017 2.5 9.5 2.5H11.5C12.8964 2.5 13.5947 2.5 14.156 2.69641C15.1613 3.0482 15.9518 3.83866 16.3036 4.84402C16.5 5.40533 16.5 6.10355 16.5 7.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-share" viewBox="0 0 24 24">
        <path
          d="M21 6.5C21 8.15685 19.6569 9.5 18 9.5C16.3431 9.5 15 8.15685 15 6.5C15 4.84315 16.3431 3.5 18 3.5C19.6569 3.5 21 4.84315 21 6.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M9 12C9 13.6569 7.65685 15 6 15C4.34315 15 3 13.6569 3 12C3 10.3431 4.34315 9 6 9C7.65685 9 9 10.3431 9 12Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M21 17.5C21 19.1569 19.6569 20.5 18 20.5C16.3431 20.5 15 19.1569 15 17.5C15 15.8431 16.3431 14.5 18 14.5C19.6569 14.5 21 15.8431 21 17.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8.72852 10.7495L15.2285 7.75M8.72852 13.25L15.2285 16.2495"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-send" viewBox="0 0 24 24">
        <path
          d="M21.0477 3.05293C18.8697 0.707363 2.48648 6.4532 2.50001 8.551C2.51535 10.9299 8.89809 11.6617 10.6672 12.1581C11.7311 12.4565 12.016 12.7625 12.2613 13.8781C13.3723 18.9305 13.9301 21.4435 15.2014 21.4996C17.2278 21.5892 23.1733 5.342 21.0477 3.05293Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M11.4999 12.5L14.9999 9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-back" viewBox="0 0 24 24">
        <path
          d="M5.5 12.002H19"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M10.9999 18.002C10.9999 18.002 4.99998 13.583 4.99997 12.0019C4.99996 10.4208 11 6.00195 11 6.00195"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-chev" viewBox="0 0 24 24">
        <path
          d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-more" viewBox="0 0 24 24">
        <path
          d="M11.9967 12.5V12M11.9967 6.5V6M11.9967 18.5V18M12.9967 12.5C12.9967 11.9477 12.549 11.5 11.9967 11.5C11.4444 11.5 10.9967 11.9477 10.9967 12.5C10.9967 13.0523 11.4444 13.5 11.9967 13.5C12.549 13.5 12.9967 13.0523 12.9967 12.5ZM12.9967 6.5C12.9967 5.94772 12.549 5.5 11.9967 5.5C11.4444 5.5 10.9967 5.94772 10.9967 6.5C10.9967 7.05228 11.4444 7.5 11.9967 7.5C12.549 7.5 12.9967 7.05228 12.9967 6.5ZM12.9967 18.5C12.9967 17.9477 12.549 17.5 11.9967 17.5C11.4444 17.5 10.9967 17.9477 10.9967 18.5C10.9967 19.0523 11.4444 19.5 11.9967 19.5C12.549 19.5 12.9967 19.0523 12.9967 18.5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-user" viewBox="0 0 24 24">
        <path
          d="M20 21.0001C19.713 17.269 16.7289 14.3151 12.995 14.0662L12 13.9999C11.6446 14.0096 11.3134 14.0225 11.0008 14.0378C7.3 14.2192 4.28417 17.3057 4 21.0001"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <circle
          cx="12"
          cy="6.99988"
          r="4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-logout" viewBox="0 0 24 24">
        <path
          d="M18 18C18 18.4644 18 18.6965 17.978 18.8918C17.7952 20.5145 16.5145 21.7952 14.8919 21.978C14.6965 22 14.4644 22 14 22H11C7.70017 22 6.05025 22 5.02513 20.9749C4 19.9498 4 18.2998 4 15L4.00001 8.99998C4.00001 5.70016 4.00003 4.05024 5.02514 3.02512C6.05027 2 7.70018 2 11 2H14C14.4644 2 14.6965 2 14.8919 2.02201C16.5145 2.20483 17.7952 3.48547 17.978 5.10816C18 5.30347 18 5.53565 18 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M8.07612 11.1183C8 11.3021 8 11.535 8 12.001C8 12.4669 8 12.6999 8.07612 12.8837C8.17761 13.1287 8.37229 13.3234 8.61732 13.4249C8.80109 13.501 9.03406 13.501 9.5 13.501H14.5C14.5002 15.2503 14.511 16.1299 15.0623 16.3858C15.0829 16.3954 15.1037 16.4042 15.1249 16.4124C15.7045 16.6353 16.3999 16.0139 17.7907 14.7711C19.2576 13.4602 19.9912 12.7851 20 11.957C19.9912 11.1289 19.2576 10.4538 17.7907 9.14301C16.3999 7.90018 15.7045 7.27876 15.1249 7.50171C15.1037 7.50985 15.0829 7.51869 15.0623 7.52822C14.5018 7.78844 14.5 8.69318 14.5 10.501H9.5C9.03406 10.501 8.80109 10.501 8.61732 10.5771C8.37229 10.6786 8.17761 10.8733 8.07612 11.1183Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-sidebar" viewBox="0 0 24 24">
        <path
          d="M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M9.5 3L9.5 21"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M5 7H6M5 10H6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-arrowup" viewBox="0 0 24 24">
        <path
          d="M12 5.5V19"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M18 11C18 11 13.5811 5.00001 12 5C10.4188 4.99999 6 11 6 11"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-moon" viewBox="0 0 24 24">
        <path
          d="M21.5 14.0784C20.3003 14.7189 18.9301 15.0821 17.4751 15.0821C12.7491 15.0821 8.91792 11.2509 8.91792 6.52485C8.91792 5.06986 9.28105 3.69968 9.92163 2.5C5.66765 3.49698 2.5 7.31513 2.5 11.8731C2.5 17.1899 6.8101 21.5 12.1269 21.5C16.6849 21.5 20.503 18.3324 21.5 14.0784Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="i-sun" viewBox="0 0 24 24">
        <path
          d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M12 2V3.5M12 20.5V22M19.0708 19.0713L18.0101 18.0106M5.98926 5.98926L4.9286 4.9286M22 12H20.5M3.5 12H2M19.0713 4.92871L18.0106 5.98937M5.98975 18.0107L4.92909 19.0714"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </symbol>
    </svg>
  );
}
