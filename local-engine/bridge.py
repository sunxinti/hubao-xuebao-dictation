"""Offline Qwen3-ASR bridge. Audio stays in memory; JSON lines over parent pipes."""
import os,sys,json,base64,io,wave,time,contextlib
from pathlib import Path

os.environ.update(HF_HUB_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',TRANSFORMERS_OFFLINE='1',DO_NOT_TRACK='1')
def no_network(event,args):
    if event in ('socket.connect','socket.bind','socket.getaddrinfo'):
        raise PermissionError('Network disabled in local speech engine')
sys.addaudithook(no_network)

def emit(value):
    print(json.dumps(value,ensure_ascii=False),flush=True)

try:
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import mlx.core as mx
        from mlx_qwen3_asr import Session
        if not mx.metal.is_available():
            raise RuntimeError('NO_METAL')
        model_path=Path(__file__).resolve().parent/'model'
        session=Session(model=str(model_path),tokenizer_model=str(model_path))
        # Resolve the lazy session before telling the desktop it is ready.
        info=session.model_info
    emit({'type':'ready','device':'Apple GPU / MLX','model':'Qwen3-ASR-0.6B'})
except Exception as error:
    emit({'type':'fatal','code':'NO_METAL' if str(error)=='NO_METAL' or 'No Metal device' in str(error) else type(error).__name__})
    raise SystemExit(1)

for line in sys.stdin:
    request_id=None
    try:
        if len(line)>17*1024*1024:raise ValueError('oversize')
        request=json.loads(line);request_id=request['id']
        raw=base64.b64decode(request['audio'],validate=True)
        if len(raw)>12*1024*1024:raise ValueError('oversize')
        with wave.open(io.BytesIO(raw),'rb') as wav:
            rate=wav.getframerate()
            if wav.getnchannels()!=1 or wav.getsampwidth()!=2 or not 8000<=rate<=48000 or wav.getnframes()/rate>121:
                raise ValueError('invalid wave')
            audio=np.frombuffer(wav.readframes(wav.getnframes()),dtype='<i2').astype(np.float32)/32768
        start=time.monotonic()
        with contextlib.redirect_stdout(sys.stderr):
            result=session.transcribe((audio,rate),language='Chinese',verbose=False)
        emit({'id':request_id,'text':result.text,'seconds':round(time.monotonic()-start,2),'truncated':result.truncated})
        del audio,raw,request,result
    except Exception as error:
        emit({'id':request_id,'error':type(error).__name__})
