const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';

const form = document.querySelector('#participantForm');
const referrerField = document.querySelector('#referrerField');
const referrerInput = form.elements.referrer;
const alertBox = document.querySelector('#alert');
const successBox = document.querySelector('#success');
const birthYearSelect = form.elements.birthYear;
const ageInput = form.elements.age;

// 1. 출생연도 옵션 생성 & 나이 자동 계산
const currentYear = new Date().getFullYear();
for (let year = currentYear; year >= currentYear - 120; year -= 1) {
  const option = document.createElement('option');
  option.value = String(year);
  option.textContent = `${year}년`;
  birthYearSelect.append(option);
}

function updateAge() {
  ageInput.value = birthYearSelect.value ? String(currentYear - Number(birthYearSelect.value)) : '';
}

birthYearSelect.addEventListener('change', updateAge);

// 2. 약관 상세보기 토글
form.querySelectorAll('.details-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const detail = document.getElementById(button.getAttribute('aria-controls'));
    if (!detail) return;

    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    detail.hidden = expanded;
  });
});

// 3. 에러 표시 및 유효성 검사 함수들
function setFieldError(name, message) {
  const error = form.querySelector(`[data-error="${name}"]`);
  if (error) error.textContent = message || '';

  const field = form.elements[name];
  if (field && typeof field.setAttribute === 'function' && field.type !== 'radio' && field.type !== 'checkbox') {
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
}

function updateReferrerVisibility() {
  const isExternal = form.querySelector('input[name="memberType"]:checked')?.value === '외부인';
  referrerField.hidden = !isExternal;
  referrerInput.required = isExternal;

  if (!isExternal) {
    referrerInput.value = '';
    setFieldError('referrer', '');
  }
}

function clearValidation() {
  form.querySelectorAll('.error').forEach(error => { error.textContent = ''; });
  form.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
}

function validateForm() {
  let valid = true;
  clearValidation();

  form.querySelectorAll('[required]').forEach(field => {
    const empty = (field.type === 'checkbox' && !field.checked)
      || (field.type === 'radio' && !form.querySelector(`[name="${field.name}"]:checked`))
      || (field.type !== 'checkbox' && field.type !== 'radio' && !field.value.trim());

    if (empty) {
      valid = false;
      const errorName = field.type === 'checkbox' ? 'consents' : field.name;
      const message = field.type === 'checkbox'
        ? '필수 동의 항목을 모두 확인해 주세요.'
        : field.type === 'radio'
          ? '필수 항목을 선택해 주세요.'
          : '필수 입력 항목이에요.';
      setFieldError(errorName, message);
    }
  });

  const age = Number(form.elements.age.value);
  if (form.elements.age.value && (age < 1 || age > 120)) {
    valid = false;
    setFieldError('age', '나이는 1~120 사이로 입력해 주세요.');
  }

  const phone = form.elements.phone.value.trim();
  if (phone && !/^[0-9+\-()\s]{9,20}$/.test(phone)) {
    valid = false;
    setFieldError('phone', '전화번호 형식을 확인해 주세요.');
  }

  const photo = form.elements.profilePhoto?.files[0];
  if (photo && photo.size > 2 * 1024 * 1024) {
    valid = false;
    setFieldError('profilePhoto', '프로필 사진은 2MB 이하만 업로드할 수 있어요.');
  }

  return valid;
}

function showMessage(element, message) {
  element.textContent = message;
  element.classList.add('show');
}

form.querySelectorAll('input[name="memberType"]').forEach(input => {
  input.addEventListener('change', updateReferrerVisibility);
});
updateReferrerVisibility();

// 💡 4. 사진 파일을 Base64 텍스트로 읽어오는 헬퍼 함수
const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

// 5. 폼 제출 (submit) 처리
form.addEventListener('submit', async event => {
  event.preventDefault();
  alertBox.classList.remove('show');
  successBox.classList.remove('show');

  if (!validateForm()) {
    showMessage(alertBox, '필수 항목을 확인해 주세요.');
    form.querySelector('[aria-invalid="true"], .error:not(:empty)')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    return;
  }

  const submitButton = form.querySelector('.submit');
  submitButton.disabled = true;
  submitButton.textContent = '제출 중... (사진 업로드 중)';

  try {
    const rawData = new FormData(form);
    const payload = {};

    // 폼 안의 데이터들을 순회하며 JSON 객체로 변환
    for (const [key, value] of rawData.entries()) {
      if (value instanceof File) {
        // 이미지 파일이 첨부되어 있다면 Base64 텍스트로 인코딩하여 저장
        if (value.size > 0) {
          payload['profilePhotoData'] = await readFileAsBase64(value);
          payload['profilePhotoName'] = value.name;
        }
      } else if (payload[key]) {
        // 체크박스 다중 선택 등 처리
        if (!Array.isArray(payload[key])) payload[key] = [payload[key]];
        payload[key].push(value);
      } else {
        payload[key] = value;
      }
    }

    // 메타데이터 추가
    payload['submittedAt'] = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    payload['formType'] = 'participant';

    // Google Apps Script로 전송
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script request failed: ${response.status}`);
    }

    form.reset();
    updateReferrerVisibility();
    updateAge();
    alert('참가 신청이 성공적으로 완료되었습니다!');
    showMessage(successBox, '신청이 완료되었습니다.');
  } catch (error) {
    console.error(error);
    alert('제출 실패. 다시 시도해 주세요.');
    showMessage(alertBox, '제출 실패. 다시 시도해 주세요.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = '참가 신청서 제출하기';
  }
});