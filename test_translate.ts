import { translate } from './src/utils/translation';

(async () => {
    const result = await translate('Hello world', 'ko-KR');
    console.log('Result:', result);
})();
