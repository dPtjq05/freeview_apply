const STORAGE_KEY = 'festival-participant-application-v1';

const form = document.querySelector('#participantForm');
const referrerField = document.querySelector('#referrerField');
const referrerInput = form.elements.referrer;
const alertBox = document.querySelector('#alert');
const successBox = document.querySelector('#success');
const birthYearSelect = form.elements.birthYear;
const ageInput = form.elements.age;

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

  const photo = form.elements.profilePhoto.files[0];
  if (photo && photo.size > 2 * 1024 * 1024) {
    valid = false;
    setFieldError('profilePhoto', '프로필 사진은 2MB 이하만 업로드할 수 있어요.');
  }

  return valid;
}

function readPhoto(file) {
  if (!file) return Promise.resolve('');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('프로필 사진을 읽지 못했어요.'));
    reader.readAsDataURL(file);
  });
}

function showMessage(element, message) {
  element.textContent = message;
  element.classList.add('show');
}

form.querySelectorAll('input[name="memberType"]').forEach(input => {
  input.addEventListener('change', updateReferrerVisibility);
});
updateReferrerVisibility();

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
  submitButton.textContent = '저장 중...';

  try {
    const data = Object.fromEntries(new FormData(form).entries());
    data.profilePhoto = await readPhoto(form.elements.profilePhoto.files[0]);
    data.submittedAt = new Date().toISOString();
    data.formType = 'participant';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    form.reset();
    updateReferrerVisibility();
    showMessage(successBox, '신청 정보가 이 기기에 저장됐어요.');
  } catch (error) {
    console.error(error);
    showMessage(alertBox, '신청 정보를 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = '참가 신청서 제출하기';
  }
});